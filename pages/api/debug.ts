import type { NextApiRequest, NextApiResponse } from 'next';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { PDFParse } from 'pdf-parse';
import firebaseApp from '../../src/firebaseAdmin';
import type { Language } from '../../src/context/EditorContext';

/**
 * AI "Debug" endpoint.
 *
 * Sends the student's current code + the problem statement to the OpenRouter
 * chat-completions API (Anthropic models; authenticated via the
 * OPENROUTER_API_KEY env var) and asks it to locate the lines that contain
 * bugs. It returns ONLY line numbers (plus a per-line reason the client may
 * choose to show or hide) so the editor can highlight the suspect lines
 * without necessarily explaining them.
 *
 * The rationale for every design decision lives in docs/DEBUG_FEATURE.md. The
 * knobs below are env-overridable so behaviour can be customised without code
 * changes (see docker-compose.yml for where they are set).
 */

// ---- Customisable configuration (env-overridable) ---------------------------
/**
 * Swappable model providers. OpenRouter and OpenAI share the OpenAI
 * chat-completions wire format; Anthropic uses its native Messages API.
 * DEBUG_PROVIDER (openrouter | anthropic | openai) forces one; otherwise the
 * first provider with a configured key wins, in that order. Tier aliases
 * (sonnet/opus/haiku, kept from the CLI era) map per provider; anything else
 * passes through verbatim as a provider-specific model id.
 */
type ProviderName = 'openrouter' | 'anthropic' | 'openai';
type Provider = {
  url: string;
  key: () => string;
  aliases: Record<string, string>;
  format: 'chat-completions' | 'anthropic-messages';
};
const PROVIDERS: Record<ProviderName, Provider> = {
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: () => process.env.OPENROUTER_API_KEY ?? '',
    aliases: {
      sonnet: 'anthropic/claude-sonnet-5',
      opus: 'anthropic/claude-opus-4.8',
      haiku: 'anthropic/claude-haiku-4.5',
    },
    format: 'chat-completions',
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    key: () => process.env.ANTHROPIC_API_KEY ?? '',
    aliases: {
      sonnet: 'claude-sonnet-5',
      opus: 'claude-opus-4-8',
      haiku: 'claude-haiku-4-5',
    },
    format: 'anthropic-messages',
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    key: () => process.env.OPENAI_API_KEY ?? '',
    aliases: {
      sonnet: 'gpt-5.1',
      opus: 'gpt-5.1',
      haiku: 'gpt-5-mini',
    },
    format: 'chat-completions',
  },
};
function pickProvider(): ProviderName {
  const forced = (process.env.DEBUG_PROVIDER ?? '').toLowerCase();
  if (
    forced === 'openrouter' ||
    forced === 'anthropic' ||
    forced === 'openai'
  ) {
    return forced;
  }
  for (const name of ['openrouter', 'anthropic', 'openai'] as ProviderName[]) {
    if (PROVIDERS[name].key()) return name;
  }
  return 'openrouter';
}
/** Model alias or slug. `sonnet` is fast and accurate enough for bug location. */
const DEFAULT_MODEL =
  process.env.DEBUG_MODEL ?? process.env.DEBUG_CLAUDE_MODEL ?? 'sonnet';
/** Hard timeout for a single analysis (ms). */
const DEBUG_TIMEOUT_MS = Number(
  process.env.DEBUG_TIMEOUT_MS ?? process.env.DEBUG_CLAUDE_TIMEOUT_MS ?? 90_000
);
/** Output is a small JSON object; bounded so a runaway reply can't balloon cost. */
const MAX_OUTPUT_TOKENS = Number(process.env.DEBUG_MAX_OUTPUT_TOKENS ?? 4_096);
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
/** PDF-only statements (njudge, oj.uz) are parsed in-process via `pdf-parse`. */
const PDF_FETCH_TIMEOUT_MS = Number(
  process.env.DEBUG_PDF_FETCH_TIMEOUT_MS ?? 20_000
);
/** A statement PDF is small; anything bigger is not a statement — skip it. */
const PDF_MAX_BYTES = Number(process.env.DEBUG_PDF_MAX_BYTES ?? 10_000_000);
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

/** Token / timing / cost stats surfaced from the OpenRouter `usage` object. */
export type DebugUsage = {
  model: string;
  durationMs: number;
  inputTokens: number; // fresh (non-cached) prompt tokens
  cacheReadTokens: number;
  cacheCreationTokens: number;
  outputTokens: number;
  totalTokens: number; // prompt + completion, per OpenRouter
  numTurns: number; // always 1 (single-turn chat completion)
  costUsd: number; // OpenRouter-billed cost for this call (credits ≈ USD)
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
  'Analyse only the provided text.',
  'Respond with ONLY a single JSON object, no markdown fences, no prose,',
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

// ---- Model invocation (OpenRouter) -------------------------------------------
type ModelRun =
  | { kind: 'ok'; content: string; usage: DebugUsage }
  | { kind: 'network-error'; detail: string }
  | { kind: 'timeout' }
  | { kind: 'http-error'; status: number; body: string }
  | { kind: 'bad-response'; detail: string };

/** Union of the response shapes we consume (chat-completions + Anthropic). */
type ProviderResponse = {
  // chat-completions (OpenRouter / OpenAI)
  choices?: { message?: { content?: unknown } }[];
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    total_tokens?: unknown;
    cost?: unknown;
    prompt_tokens_details?: {
      cached_tokens?: unknown;
      cache_write_tokens?: unknown;
    };
    // anthropic-messages usage
    input_tokens?: unknown;
    output_tokens?: unknown;
    cache_read_input_tokens?: unknown;
    cache_creation_input_tokens?: unknown;
  };
  error?: { message?: unknown };
  // anthropic-messages content blocks
  content?: { type?: unknown; text?: unknown }[];
};

/**
 * One provider call: system prompt + user prompt, bounded output, hard
 * timeout. `model` is a tier alias (sonnet/opus/haiku) or a full
 * provider-specific model id. Every failure mode stays a distinct `kind` so
 * the handler and logs can tell a pipeline failure from a model one.
 * `costUsd` is reported only by OpenRouter; 0 means "not reported".
 */
async function runModel(
  userPrompt: string,
  model: string,
  timeoutMs: number,
  providerName: ProviderName
): Promise<ModelRun> {
  const provider = PROVIDERS[providerName];
  const key = provider.key();
  if (!key) {
    return {
      kind: 'network-error',
      detail: `missing API key for ${providerName}`,
    };
  }
  const anthropic = provider.format === 'anthropic-messages';
  const startedAt = Date.now();
  let resp: globalThis.Response;
  try {
    resp = await fetch(provider.url, {
      method: 'POST',
      headers: anthropic
        ? {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          }
        : {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
      body: JSON.stringify(
        anthropic
          ? {
              model: provider.aliases[model] ?? model,
              max_tokens: MAX_OUTPUT_TOKENS,
              system: SYSTEM_PROMPT,
              messages: [{ role: 'user', content: userPrompt }],
            }
          : {
              model: provider.aliases[model] ?? model,
              max_tokens: MAX_OUTPUT_TOKENS,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
              ],
            }
      ),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const err = e as Error;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { kind: 'timeout' };
    }
    return { kind: 'network-error', detail: err.message };
  }
  const bodyText = await resp.text();
  if (!resp.ok) {
    return { kind: 'http-error', status: resp.status, body: bodyText };
  }
  let body: ProviderResponse;
  try {
    body = JSON.parse(bodyText) as ProviderResponse;
  } catch {
    return { kind: 'bad-response', detail: `unparseable body: ${bodyText}` };
  }
  if (body.error) {
    return {
      kind: 'bad-response',
      detail: `api error: ${String(body.error.message)}`,
    };
  }
  // Anthropic content is a block array (a thinking block may precede the
  // text block on adaptive-thinking models); chat-completions is a string.
  const content = anthropic
    ? body.content?.find(b => b.type === 'text')?.text
    : body.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    return {
      kind: 'bad-response',
      detail: `no completion content: ${bodyText}`,
    };
  }
  const n = (v: unknown): number =>
    typeof v === 'number' ? v : Number(v) || 0;
  const u = body.usage ?? {};
  const cacheReadTokens = anthropic
    ? n(u.cache_read_input_tokens)
    : n(u.prompt_tokens_details?.cached_tokens);
  const cacheCreationTokens = anthropic
    ? n(u.cache_creation_input_tokens)
    : n(u.prompt_tokens_details?.cache_write_tokens);
  const inputTokens = anthropic
    ? n(u.input_tokens)
    : // chat-completions prompt_tokens INCLUDES cached tokens; report the
      // fresh remainder to keep the field's "non-cached input" meaning.
      Math.max(0, n(u.prompt_tokens) - cacheReadTokens);
  const outputTokens = anthropic ? n(u.output_tokens) : n(u.completion_tokens);
  return {
    kind: 'ok',
    content,
    usage: {
      model,
      durationMs: Date.now() - startedAt,
      inputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      outputTokens,
      totalTokens: anthropic
        ? inputTokens + cacheReadTokens + cacheCreationTokens + outputTokens
        : n(u.total_tokens),
      numTurns: 1,
      costUsd: n(u.cost),
    },
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
 * Fetch a PDF problem statement and extract its text via `pdf-parse` (pure-JS
 * pdf.js — no binary, so it also runs on Vercel; the earlier `pdftotext`
 * subprocess only existed in the Docker image). Used for platforms whose
 * statement is a PDF (njudge, oj.uz) rather than HTML, so the AI gets the real
 * problem text. Returns null (and the caller proceeds without a statement) on
 * any failure — never blocks the debug request.
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
  if (buf.length === 0 || buf.length > PDF_MAX_BYTES) return null;
  const parser = new PDFParse({
    data: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
  });
  try {
    const result = await parser.getText();
    return result.text.trim() ? result.text : null;
  } catch {
    return null; // corrupt / non-PDF content — proceed without a statement
  } finally {
    await parser.destroy().catch(() => undefined);
  }
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

/**
 * Durable audit trail: every call is also persisted as one Firestore document,
 * because Vercel's runtime-log retention is short (1 h on Hobby, 1 day on Pro)
 * and we want full hindsight on what the feature did. Unlike the console line,
 * the audit record includes the (capped) student code and statement, plus the
 * findings — enough to replay any call. The collection has no client rules, so
 * only the admin SDK (server) can touch it. A failed write must never fail the
 * debug request itself, but it is loudly console.error'd (fail-open here only
 * affects the audit copy — the console log line above has already happened).
 */
const AUDIT_COLLECTION = process.env.DEBUG_AUDIT_COLLECTION ?? 'debugLogs';
async function persistAuditRecord(
  record: Record<string, unknown>
): Promise<void> {
  try {
    await getFirestore(firebaseApp).collection(AUDIT_COLLECTION).add(record);
  } catch (e) {
    console.error('[ai-debug] audit-write-failed:', e);
  }
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

  // Auth gate: the OpenRouter API key is a shared, paid resource, so only an
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
  // Optional per-request model override (alias like sonnet/opus/haiku, or a
  // full OpenRouter slug such as anthropic/claude-haiku-4.5). Validated to a
  // safe charset; anything else falls back to the env-configured default.
  const model =
    typeof body.model === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._/:-]*$/.test(body.model)
      ? body.model
      : DEFAULT_MODEL;
  // Per-request timeout override, clamped to [5s, 300s]; defaults to the
  // production value. Lets the evaluation harness allow slower hard problems
  // without raising the user-facing default (fast-fail is better UX in the IDE).
  const timeoutMs =
    typeof body.timeoutMs === 'number' && Number.isFinite(body.timeoutMs)
      ? Math.min(300_000, Math.max(5_000, body.timeoutMs))
      : DEBUG_TIMEOUT_MS;
  const lineCount = request.code.slice(0, MAX_CODE_CHARS).split('\n').length;

  // Shared (metadata-only) fields for the debug log; per-outcome fields are
  // merged in below. We log sizes, not the code/statement text — enough to debug
  // a call from the server logs without dumping student code on every request.
  const startedAt = Date.now();
  const provider = pickProvider();
  const logBase = {
    ts: new Date().toISOString(),
    event: 'debug_call',
    uid: auth.uid,
    provider,
    model,
    language: request.language,
    problemTitle: request.problemTitle,
    problemStatementUrl: body.problemStatementUrl ?? null,
    statementSource,
    codeChars: request.code.length,
    statementChars: request.problemStatement?.length ?? 0,
    timeoutMs,
  };
  // The audit copy additionally carries the actual (capped) inputs, so a call
  // can be fully reconstructed later; the console line stays metadata-only.
  const auditBase = {
    ...logBase,
    code: request.code.slice(0, MAX_CODE_CHARS),
    statement: request.problemStatement?.slice(0, MAX_STATEMENT_CHARS) ?? null,
  };
  // Log + persist + respond together so no exit path can answer without both a
  // console record and a durable audit record. The audit write is awaited
  // BEFORE the response is sent: on serverless the instance may be frozen right
  // after res.json, so responding first could lose the record.
  const respondError = async (
    status: number,
    payload: Extract<DebugResponse, { ok: false }>,
    outcome: string,
    extra?: Record<string, unknown>
  ): Promise<void> => {
    const detail = payload.detail ? capForLog(payload.detail) : undefined;
    logDebugCall({
      ...logBase,
      durationMs: Date.now() - startedAt,
      outcome,
      error: payload.error,
      detail,
      ...extra,
    });
    await persistAuditRecord({
      ...auditBase,
      durationMs: Date.now() - startedAt,
      outcome,
      error: payload.error,
      detail: detail ?? null,
      ...extra,
    });
    // Send ONLY the error code to the client; the raw model/provider output
    // (payload.detail + extra) stays in the server log above, never in the HTTP
    // response, to avoid leaking internal diagnostics.
    res.status(status).json({ ok: false, error: payload.error });
  };

  const run = await runModel(
    buildUserPrompt(request),
    model,
    timeoutMs,
    provider
  );

  // Keep every failure mode distinct (never collapse "no output" with "wrong
  // output"): the caller and logs can tell a pipeline failure from a model one.
  if (run.kind === 'network-error') {
    await respondError(
      500,
      { ok: false, error: 'model-unavailable', detail: run.detail },
      'network-error'
    );
    return;
  }
  if (run.kind === 'timeout') {
    await respondError(504, { ok: false, error: 'model-timeout' }, 'timeout');
    return;
  }
  if (run.kind === 'http-error') {
    await respondError(
      502,
      {
        ok: false,
        error: 'model-failed',
        detail: `http ${run.status}: ${run.body.slice(0, 600)}`,
      },
      'http-error',
      { httpStatus: run.status, body: capForLog(run.body) }
    );
    return;
  }
  if (run.kind === 'bad-response') {
    await respondError(
      502,
      {
        ok: false,
        error: 'model-error',
        detail: run.detail.slice(0, 500),
      },
      'bad-response',
      { detailFull: capForLog(run.detail) }
    );
    return;
  }

  const resultText = run.content;
  const extracted = extractFindings(resultText, lineCount);
  if (!extracted) {
    await respondError(
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

  const usage = run.usage;
  logDebugCall({
    ...logBase,
    durationMs: Date.now() - startedAt,
    outcome: 'success',
    findingsCount: extracted.findings.length,
    findingLines: extracted.findings.map(f => f.line),
    summaryChars: extracted.summary.length,
    usage,
  });
  await persistAuditRecord({
    ...auditBase,
    durationMs: Date.now() - startedAt,
    outcome: 'success',
    findings: extracted.findings,
    summary: extracted.summary,
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
