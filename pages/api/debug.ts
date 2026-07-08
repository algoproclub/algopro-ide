import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { getAuth } from 'firebase-admin/auth';
import firebaseApp from '../../src/firebaseAdmin';
import type { Language } from '../../src/context/EditorContext';

/**
 * AI "Debug" endpoint.
 *
 * Sends the student's current code + the problem statement to the `claude` CLI
 * (Claude Code, authenticated at runtime via the CLAUDE_CODE_OAUTH_TOKEN env
 * var) and asks it to locate the lines that contain bugs. It returns ONLY line
 * numbers (plus a per-line reason the client may choose to show or hide) so the
 * editor can highlight the suspect lines without necessarily explaining them.
 *
 * The rationale for every design decision lives in docs/DEBUG_FEATURE.md. The
 * knobs below are env-overridable so behaviour can be customised without code
 * changes (see docker-compose.yml for where they are set).
 */

// ---- Customisable configuration (env-overridable) ---------------------------
/** The Claude Code binary. Baked into the web image via the Dockerfile. */
const CLAUDE_BIN = process.env.DEBUG_CLAUDE_BIN ?? 'claude';
/** Model alias or id. `sonnet` is fast and accurate enough for bug location. */
const CLAUDE_MODEL = process.env.DEBUG_CLAUDE_MODEL ?? 'sonnet';
/** Hard timeout for a single analysis (ms). */
const CLAUDE_TIMEOUT_MS = Number(process.env.DEBUG_CLAUDE_TIMEOUT_MS ?? 90_000);
/**
 * Language the AI must write its student-facing text (`reason` + `summary`) in.
 * The instructions themselves stay in English — models follow English system
 * prompts most reliably and the tuned prompt stays maintainable — only the
 * OUTPUT is localised. Override with DEBUG_OUTPUT_LANGUAGE (e.g. `English`).
 */
const OUTPUT_LANGUAGE = process.env.DEBUG_OUTPUT_LANGUAGE ?? 'Hungarian';
/** Guardrails so a huge paste can't blow up the prompt. */
const MAX_CODE_CHARS = Number(process.env.DEBUG_MAX_CODE_CHARS ?? 60_000);
const MAX_STATEMENT_CHARS = Number(
  process.env.DEBUG_MAX_STATEMENT_CHARS ?? 20_000
);
/** `pdftotext` (poppler-utils) reads PDF-only statements (njudge, oj.uz). */
const PDF_BIN = process.env.DEBUG_PDF_BIN ?? 'pdftotext';
const PDF_FETCH_TIMEOUT_MS = Number(
  process.env.DEBUG_PDF_FETCH_TIMEOUT_MS ?? 20_000
);
/**
 * SSRF guard for the server-side PDF fetch (the URL is caller-supplied). Always
 * reject hosts that resolve to a private/loopback/link-local/metadata address.
 * Optionally restrict to a comma-separated host allowlist; empty = allow any
 * PUBLIC host (only njudge.hu / oj.uz actually use a PDF statement URL).
 */
const PDF_HOST_ALLOWLIST = (process.env.DEBUG_PDF_HOST_ALLOWLIST ?? '')
  .split(',')
  .map(h => h.trim().toLowerCase())
  .filter(Boolean);
/**
 * Tools are disabled: the prompt is fully self-contained, so Claude should
 * answer in a single turn without touching the filesystem or network (faster,
 * and safe inside the container).
 */
const DISALLOWED_TOOLS =
  process.env.DEBUG_DISALLOWED_TOOLS ??
  'Bash,Read,Edit,Write,WebFetch,WebSearch,Glob,Grep,Task,TodoWrite,NotebookEdit';

/**
 * Each AI call is logged as one structured line to the server console (stdout on
 * success, stderr on failure) so it's debuggable via the normal log stream
 * (`docker compose logs web`) — no extra files or volumes. Long diagnostic fields
 * are capped so one line can't balloon the log.
 */
const LOG_MAX_FIELD_CHARS = Number(
  process.env.DEBUG_LOG_MAX_FIELD_CHARS ?? 4_000
);

const LANGUAGE_LABELS: Record<Language, string> = {
  cpp: 'C++',
  java: 'Java',
  py: 'Python',
};

// ---- Request / response types ----------------------------------------------
type DebugRequest = {
  /** Firebase ID token of the calling user; the endpoint is auth-gated. */
  idToken?: string | null;
  language: Language;
  code: string;
  problemTitle?: string | null;
  problemStatement?: string | null;
  /** PDF statement URL (njudge/oj.uz); used only if problemStatement is empty. */
  problemStatementUrl?: string | null;
  /** Optional per-request model override (alias like sonnet/opus/haiku or id). */
  model?: string | null;
  /** Optional per-request timeout override in ms (capped); for evaluation. */
  timeoutMs?: number | null;
};

export type DebugFinding = { line: number; reason: string };

/** Token / timing / cost stats surfaced from the `claude --output-format json` envelope. */
export type DebugUsage = {
  model: string;
  durationMs: number;
  inputTokens: number; // fresh (non-cached) input tokens
  cacheReadTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  totalTokens: number; // input + cacheRead + cacheCreation + output
  numTurns: number;
  costUsd: number; // Anthropic-billed cost for this call, per the CLI
};

type DebugResponse =
  | {
      ok: true;
      findings: DebugFinding[];
      summary: string;
      model: string;
      usage: DebugUsage;
    }
  | { ok: false; error: string; detail?: string };

// ---- Prompt construction ----------------------------------------------------
function numberLines(source: string): string {
  const lines = source.split('\n');
  const width = String(lines.length).length;
  return lines
    .map((line, index) => `${String(index + 1).padStart(width, ' ')} | ${line}`)
    .join('\n');
}

const SYSTEM_PROMPT = [
  'You are a bug locator embedded in a competitive-programming IDE.',
  "You are given a problem statement and a student's source code with 1-based",
  'line numbers shown before a "|" on each line.',
  'Identify the specific lines that contain a bug or are the root cause of an',
  'incorrect or non-accepted solution. Prefer a small number of high-confidence',
  'lines over many speculative ones. Each line "reason" is shown to the student',
  'on hover, so make it a concise, specific explanation of what is wrong there.',
  'The "summary" is shown to the student as a global note: use it for the overall',
  'diagnosis, and ESPECIALLY for problems that cannot be tied to a single line —',
  'a wrong overall approach, a missing case, missing output/initialisation, logic',
  'spread across the code, etc. In that case return an EMPTY buggyLines array and',
  'put the full explanation in summary. If the code looks correct, return empty',
  'buggyLines and say so in summary.',
  `The student is ${OUTPUT_LANGUAGE}-speaking: write every "reason" value and the`,
  `"summary" value in ${OUTPUT_LANGUAGE} — natural, fluent ${OUTPUT_LANGUAGE} —`,
  'no matter what language the problem statement, code, or comments are in. Keep',
  'the JSON keys, code identifiers, quoted snippets and line numbers unchanged.',
  'Report line numbers exactly as shown in the numbered listing.',
  'Do NOT use any tools. Do NOT read or write files. Analyse only the provided',
  'text. Respond with ONLY a single JSON object, no markdown fences, no prose,',
  'of the form:',
  '{"buggyLines":[{"line":<int>,"reason":"<short>"}],"summary":"<text>"}',
].join(' ');

function buildUserPrompt(req: DebugRequest): string {
  const code = req.code.slice(0, MAX_CODE_CHARS);
  const parts = [
    `Language: ${LANGUAGE_LABELS[req.language] ?? req.language}`,
    '',
  ];
  if (req.problemTitle) {
    parts.push(`Problem title: ${req.problemTitle}`, '');
  }
  if (req.problemStatement) {
    parts.push(
      'Problem statement (may contain HTML):',
      req.problemStatement.slice(0, MAX_STATEMENT_CHARS),
      ''
    );
  } else {
    parts.push(
      'No problem statement was provided; judge the code on general correctness.',
      ''
    );
  }
  parts.push('Student code (with line numbers):', numberLines(code));
  return parts.join('\n');
}

// ---- Claude invocation ------------------------------------------------------
type ClaudeRun =
  | { kind: 'ok'; stdout: string }
  | { kind: 'spawn-error'; detail: string }
  | { kind: 'timeout' }
  | { kind: 'exit-error'; code: number; stderr: string; stdout: string };

function runClaude(
  userPrompt: string,
  model: string,
  timeoutMs: number
): Promise<ClaudeRun> {
  return new Promise(resolve => {
    const args = [
      '--print',
      '--output-format',
      'json',
      '--model',
      // `model` is regex-validated by the caller to NOT start with `-`, so it
      // can't be mistaken for a CLI flag even though it's a separate token.
      model,
      '--dangerously-skip-permissions',
      '--disallowed-tools',
      DISALLOWED_TOOLS,
      '--append-system-prompt',
      SYSTEM_PROMPT,
    ];

    // The Next.js dev server runs with NODE_OPTIONS=--inspect (see the `dev`
    // script). `claude` is itself a Node CLI, so if it inherited that, its Node
    // would try to bind the already-in-use inspector port and die instantly
    // (exit 1, no output). Strip it for the child. IS_SANDBOX (which lets the CLI
    // allow --dangerously-skip-permissions as root) is taken from the environment
    // — set in docker-compose.yml, NOT defaulted here, so a non-sandboxed host
    // doesn't silently get permission-skipping.
    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    delete childEnv.NODE_OPTIONS;

    const child = spawn(CLAUDE_BIN, args, {
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result: ClaudeRun) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ kind: 'timeout' });
    }, timeoutMs);

    child.stdout.on('data', chunk => (stdout += chunk));
    child.stderr.on('data', chunk => (stderr += chunk));
    child.on('error', err =>
      finish({ kind: 'spawn-error', detail: err.message })
    );
    child.on('close', code => {
      if (code === 0) {
        finish({ kind: 'ok', stdout });
      } else {
        finish({ kind: 'exit-error', code: code ?? -1, stderr, stdout });
      }
    });

    child.stdin.write(userPrompt);
    child.stdin.end();
  });
}

/**
 * `--output-format json` prints one JSON envelope. Tolerate leading/trailing
 * noise (e.g. a first-run banner) by scanning for the JSON object, mirroring
 * the todoist-claude daemon's parser.
 */
function resultToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return JSON.stringify(value);
}

function parseEnvelope(stdout: string): Record<string, unknown> | null {
  const text = stdout.trim();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          // keep scanning
        }
      }
    }
    return null;
  }
}

function parseUsage(
  envelope: Record<string, unknown>,
  model: string
): DebugUsage {
  const u =
    typeof envelope.usage === 'object' && envelope.usage !== null
      ? (envelope.usage as Record<string, unknown>)
      : {};
  const n = (v: unknown): number =>
    typeof v === 'number' ? v : Number(v) || 0;
  const inputTokens = n(u.input_tokens);
  const cacheReadTokens = n(u.cache_read_input_tokens);
  const cacheCreationTokens = n(u.cache_creation_input_tokens);
  const outputTokens = n(u.output_tokens);
  return {
    model,
    durationMs: n(envelope.duration_ms),
    inputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    outputTokens,
    totalTokens:
      inputTokens + cacheReadTokens + cacheCreationTokens + outputTokens,
    numTurns: n(envelope.num_turns),
    costUsd: n(envelope.total_cost_usd),
  };
}

function extractFindings(
  resultText: string,
  lineCount: number
): { findings: DebugFinding[]; summary: string } | null {
  const match = resultText.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as { buggyLines?: unknown; summary?: unknown };
  if (!Array.isArray(obj.buggyLines)) return null;

  const findings: DebugFinding[] = [];
  for (const raw of obj.buggyLines) {
    if (typeof raw !== 'object' || raw === null) continue;
    const candidate = raw as { line?: unknown; reason?: unknown };
    const line = Number(candidate.line);
    // Drop out-of-range lines rather than highlight nothing; a model that
    // points outside the file is wrong, but valid findings should still show.
    if (!Number.isInteger(line) || line < 1 || line > lineCount) continue;
    findings.push({
      line,
      reason: typeof candidate.reason === 'string' ? candidate.reason : '',
    });
  }
  return {
    findings,
    summary: typeof obj.summary === 'string' ? obj.summary : '',
  };
}

// ---- PDF statement extraction ----------------------------------------------
/** True if an IPv4 string is in a private / loopback / link-local / CGNAT range. */
function ipv4IsPrivate(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // link-local, incl. 169.254.169.254 cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) // CGNAT
  );
}

/** True if an IP literal targets a non-public address we must not fetch. */
function ipIsPrivate(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) return ipv4IsPrivate(ip);
  if (fam === 6) {
    const v = ip.toLowerCase().replace(/^\[|\]$/g, '');
    if (v === '::1' || v === '::') return true;
    // fe80::/10 (link-local) + fc00::/7 (unique-local)
    if (/^fe[89ab]/.test(v) || v.startsWith('fc') || v.startsWith('fd'))
      return true;
    const mapped = v.match(/(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/); // IPv4-mapped
    if (mapped) return ipv4IsPrivate(mapped[1]);
    return false;
  }
  return true; // not a valid IP literal → reject
}

/**
 * SSRF guard: only allow fetching an http(s) URL whose host is public (and, if
 * DEBUG_PDF_HOST_ALLOWLIST is set, on the allowlist). Resolves the host and
 * rejects if any resolved address is private/loopback/link-local/metadata.
 * (Residual: DNS-rebinding between this check and the fetch is not closed here.)
 */
async function isFetchableStatementUrl(url: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  // URL.hostname keeps the brackets on an IPv6 literal ([::1]); strip them so
  // isIP/ipIsPrivate can classify it instead of falling through to a DNS lookup.
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    PDF_HOST_ALLOWLIST.length > 0 &&
    !PDF_HOST_ALLOWLIST.some(a => host === a || host.endsWith(`.${a}`))
  ) {
    return false;
  }
  if (isIP(host)) return !ipIsPrivate(host);
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every(a => !ipIsPrivate(a.address));
  } catch {
    return false;
  }
}

/**
 * Fetch a PDF problem statement and extract its text via `pdftotext`. Used for
 * platforms whose statement is a PDF (njudge, oj.uz) rather than HTML, so the AI
 * gets the real problem text. Returns null (and the caller proceeds without a
 * statement) on any failure — never blocks the debug request.
 */
async function extractPdfText(url: string): Promise<string | null> {
  if (!(await isFetchableStatementUrl(url))) return null;
  let buf: Buffer;
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) return null;
    buf = Buffer.from(await resp.arrayBuffer());
  } catch {
    return null;
  }
  if (buf.length === 0) return null;
  return new Promise<string | null>(resolve => {
    const child = spawn(PDF_BIN, ['-q', '-', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let settled = false;
    const done = (v: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(v);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      done(null);
    }, 15_000);
    child.stdout.on('data', chunk => (out += chunk));
    child.stdin.on('error', () => {}); // ignore EPIPE if pdftotext exits early
    child.on('error', () => done(null)); // e.g. pdftotext not installed
    child.on('close', code => done(code === 0 && out.trim() ? out : null));
    child.stdin.write(buf);
    child.stdin.end();
  });
}

// ---- Logging ----------------------------------------------------------------
/** Bound a long field so one log record can't balloon the file. */
function capForLog(s: string): string {
  if (s.length <= LOG_MAX_FIELD_CHARS) return s;
  return `${s.slice(0, LOG_MAX_FIELD_CHARS)}…[+${
    s.length - LOG_MAX_FIELD_CHARS
  } chars]`;
}

/**
 * Log one AI call as a single structured console line — stdout on success, stderr
 * on failure — so it lands in the normal server logs and is greppable by the
 * `[ai-debug]` tag. Pure logging: it never touches the response or throws.
 */
function logDebugCall(entry: Record<string, unknown>): void {
  const line = `[ai-debug] ${JSON.stringify(entry)}`;
  if (entry.outcome === 'success') console.log(line);
  else console.error(line);
}

// ---- Handler ----------------------------------------------------------------
export default async (
  req: NextApiRequest,
  res: NextApiResponse<DebugResponse>
) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method-not-allowed' });
    return;
  }

  const body = req.body as Partial<DebugRequest>;

  // Auth gate: the `claude` OAuth token is a shared, paid resource, so only an
  // authenticated + registered user may spend it. Verify the Firebase ID token
  // (mirrors copyFile.tsx) and require the same `registered` claim the RTDB rules
  // demand. Rejects anonymous/invalid (401) and signed-in-but-unregistered (403).
  let auth;
  try {
    auth = await getAuth(firebaseApp).verifyIdToken(
      typeof body.idToken === 'string' ? body.idToken : ''
    );
  } catch {
    res.status(401).json({ ok: false, error: 'unauthenticated' });
    return;
  }
  if (auth.registered !== true) {
    res.status(403).json({ ok: false, error: 'not-registered' });
    return;
  }

  if (typeof body?.code !== 'string' || body.code.trim() === '') {
    res.status(400).json({ ok: false, error: 'missing-code' });
    return;
  }
  if (
    body.language !== 'cpp' &&
    body.language !== 'java' &&
    body.language !== 'py'
  ) {
    res.status(400).json({ ok: false, error: 'invalid-language' });
    return;
  }

  const request: DebugRequest = {
    language: body.language,
    code: body.code,
    problemTitle: body.problemTitle ?? null,
    problemStatement: body.problemStatement ?? null,
  };
  // Track where the statement came from, for the debug log: an inline statement
  // from the client, a PDF we fetched + extracted, or none at all.
  let statementSource: 'inline' | 'pdf' | 'none' =
    request.problemStatement && request.problemStatement.trim()
      ? 'inline'
      : 'none';
  // If only a PDF statement URL was provided (njudge / oj.uz have PDF-only
  // statements), fetch + extract it so the model gets the real problem text.
  if (
    (!request.problemStatement || !request.problemStatement.trim()) &&
    typeof body.problemStatementUrl === 'string' &&
    body.problemStatementUrl
  ) {
    const pdfText = await extractPdfText(body.problemStatementUrl);
    if (pdfText) {
      request.problemStatement = pdfText.slice(0, MAX_STATEMENT_CHARS);
      statementSource = 'pdf';
    }
  }
  // Optional per-request model override (alias/id); validated to avoid passing
  // anything weird as a CLI arg. Defaults to the env-configured model.
  // Validate the per-request override: must NOT start with `-` (so it can never
  // be mistaken for a CLI flag — see runClaude) and only safe chars otherwise.
  const model =
    typeof body.model === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(body.model)
      ? body.model
      : CLAUDE_MODEL;
  // Per-request timeout override, clamped to [5s, 300s]; defaults to the
  // production value. Lets the evaluation harness allow slower hard problems
  // without raising the user-facing default (fast-fail is better UX in the IDE).
  const timeoutMs =
    typeof body.timeoutMs === 'number' && Number.isFinite(body.timeoutMs)
      ? Math.min(300_000, Math.max(5_000, body.timeoutMs))
      : CLAUDE_TIMEOUT_MS;
  const lineCount = request.code.slice(0, MAX_CODE_CHARS).split('\n').length;

  // Shared (metadata-only) fields for the debug log; per-outcome fields are
  // merged in below. We log sizes, not the code/statement text — enough to debug
  // a call from the server logs without dumping student code on every request.
  const startedAt = Date.now();
  const logBase = {
    ts: new Date().toISOString(),
    event: 'debug_call',
    model,
    language: request.language,
    problemTitle: request.problemTitle,
    problemStatementUrl: body.problemStatementUrl ?? null,
    statementSource,
    codeChars: request.code.length,
    statementChars: request.problemStatement?.length ?? 0,
    timeoutMs,
  };
  // Log + respond together so no exit path can answer without a log record.
  const respondError = (
    status: number,
    payload: Extract<DebugResponse, { ok: false }>,
    outcome: string,
    extra?: Record<string, unknown>
  ): void => {
    logDebugCall({
      ...logBase,
      durationMs: Date.now() - startedAt,
      outcome,
      error: payload.error,
      detail: payload.detail ? capForLog(payload.detail) : undefined,
      ...extra,
    });
    // Send ONLY the error code to the client; the raw CLI stderr/stdout/result
    // (payload.detail + extra) stays in the server log above, never in the HTTP
    // response, to avoid leaking internal diagnostics.
    res.status(status).json({ ok: false, error: payload.error });
  };

  const run = await runClaude(buildUserPrompt(request), model, timeoutMs);

  // Keep every failure mode distinct (never collapse "no output" with "wrong
  // output"): the caller and logs can tell a pipeline failure from a model one.
  if (run.kind === 'spawn-error') {
    respondError(
      500,
      { ok: false, error: 'claude-unavailable', detail: run.detail },
      'spawn-error'
    );
    return;
  }
  if (run.kind === 'timeout') {
    respondError(504, { ok: false, error: 'claude-timeout' }, 'timeout');
    return;
  }
  if (run.kind === 'exit-error') {
    const diag =
      run.stderr.trim() || run.stdout.trim() || '(no output on either stream)';
    respondError(
      502,
      {
        ok: false,
        error: 'claude-failed',
        detail: `exit ${run.code} [IS_SANDBOX=${
          process.env.IS_SANDBOX ?? 'unset'
        }]: ${diag.slice(-600)}`,
      },
      'exit-error',
      {
        exitCode: run.code,
        stderr: capForLog(run.stderr),
        stdout: capForLog(run.stdout),
      }
    );
    return;
  }

  const envelope = parseEnvelope(run.stdout);
  if (!envelope) {
    respondError(
      502,
      {
        ok: false,
        error: 'unparseable-envelope',
        detail: run.stdout.slice(0, 300),
      },
      'unparseable-envelope',
      { stdout: capForLog(run.stdout) }
    );
    return;
  }
  if (envelope.is_error) {
    respondError(
      502,
      {
        ok: false,
        error: 'model-error',
        detail: resultToString(envelope.result).slice(0, 500),
      },
      'model-error',
      { resultText: capForLog(resultToString(envelope.result)) }
    );
    return;
  }

  const resultText = resultToString(envelope.result);
  const extracted = extractFindings(resultText, lineCount);
  if (!extracted) {
    respondError(
      502,
      {
        ok: false,
        error: 'unparseable-findings',
        detail: resultText.slice(0, 300),
      },
      'unparseable-findings',
      { resultText: capForLog(resultText) }
    );
    return;
  }

  const usage = parseUsage(envelope, model);
  logDebugCall({
    ...logBase,
    durationMs: Date.now() - startedAt,
    outcome: 'success',
    findingsCount: extracted.findings.length,
    findingLines: extracted.findings.map(f => f.line),
    summaryChars: extracted.summary.length,
    usage,
  });
  res.status(200).json({
    ok: true,
    findings: extracted.findings,
    summary: extracted.summary,
    model,
    usage,
  });
};
