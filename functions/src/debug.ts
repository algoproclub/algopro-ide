import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import * as path from 'path';

/**
 * AI "Debug" as a 2nd-gen callable (Cloud Run under the hood), so it can bundle
 * and spawn the `claude` CLI — which Vercel's ephemeral functions cannot. The
 * client calls it with httpsCallable(getFunctions(undefined,'europe-west1'),
 * 'debugCode'); onCall verifies the Firebase ID token for us (request.auth), so
 * the auth gating is native. Ported from pages/api/debug.ts.
 */
export const claudeOAuthToken = defineString('CLAUDE_CODE_OAUTH_TOKEN');

type Language = 'cpp' | 'java' | 'py';
type DebugFinding = { line: number; reason: string };
export type DebugRequest = {
  language: Language;
  code: string;
  problemTitle?: string | null;
  problemStatement?: string | null;
};
/** The callable resolves with this directly; failures throw HttpsError. */
export type DebugResult = {
  findings: DebugFinding[];
  summary: string;
  model: string;
};

const LANG_LABEL: Record<Language, string> = {
  cpp: 'C++',
  java: 'Java',
  py: 'Python',
};
const MODEL = process.env.DEBUG_CLAUDE_MODEL ?? 'sonnet';
const OUTPUT_LANGUAGE = process.env.DEBUG_OUTPUT_LANGUAGE ?? 'Hungarian';
const TIMEOUT_MS = Number(process.env.DEBUG_CLAUDE_TIMEOUT_MS ?? 120_000);
const MAX_CODE = 60_000;
const MAX_STATEMENT = 20_000;
const DISALLOWED_TOOLS =
  'Bash,Read,Edit,Write,WebFetch,WebSearch,Glob,Grep,Task,TodoWrite,NotebookEdit';

const SYSTEM_PROMPT = [
  'You are a bug locator embedded in a competitive-programming IDE.',
  "You are given a problem statement and a student's source code with 1-based",
  'line numbers shown before a "|" on each line.',
  'Identify the specific lines that contain a bug or are the root cause of an',
  'incorrect or non-accepted solution. Prefer a small number of high-confidence',
  'lines over many speculative ones. Each line "reason" is shown to the student',
  'on hover, so make it a concise, specific explanation of what is wrong there.',
  'The "summary" is shown as a global note: use it for the overall diagnosis and',
  'ESPECIALLY for problems not tied to a single line (wrong approach, missing',
  'case, missing output). If the code looks correct, return empty buggyLines and',
  'say so in summary.',
  `The student is Hungarian-speaking: write every "reason" and the "summary" in`,
  `${OUTPUT_LANGUAGE} — natural, fluent ${OUTPUT_LANGUAGE} — regardless of the`,
  'language of the problem statement or code. Keep the JSON keys, code',
  'identifiers and line numbers unchanged. Report line numbers exactly as shown.',
  'Do NOT use any tools. Respond with ONLY a single JSON object, no markdown',
  'fences, of the form:',
  '{"buggyLines":[{"line":<int>,"reason":"<short>"}],"summary":"<text>"}',
].join(' ');

function numberLines(src: string): string {
  const lines = src.split('\n');
  const w = String(lines.length).length;
  return lines
    .map((l, i) => `${String(i + 1).padStart(w, ' ')} | ${l}`)
    .join('\n');
}

function buildPrompt(req: DebugRequest): string {
  const code = req.code.slice(0, MAX_CODE);
  const parts = [`Language: ${LANG_LABEL[req.language] ?? req.language}`, ''];
  if (req.problemTitle) parts.push(`Problem title: ${req.problemTitle}`, '');
  if (req.problemStatement) {
    parts.push(
      'Problem statement:',
      req.problemStatement.slice(0, MAX_STATEMENT),
      ''
    );
  } else {
    parts.push('No problem statement provided; judge on general correctness.', '');
  }
  parts.push('Student code (with line numbers):', numberLines(code));
  return parts.join('\n');
}

/**
 * Resolve the CLI entry of the bundled `@anthropic-ai/claude-code` package.
 * Since v2.x the package ships a NATIVE per-platform binary (its `bin.claude`
 * points to an executable launcher, e.g. `bin/claude.exe`), not a JS file, so it
 * must be spawned directly — NOT via `node <path>`. Older versions shipped a
 * `cli.js`, which has to run under Node. We return both the path and how to run
 * it so callers don't have to guess. Works in Cloud Run / the emulator without a
 * globally-installed `claude` on PATH.
 */
function resolveClaudeCli(): { path: string; viaNode: boolean } {
  const requireFn = createRequire(__filename);
  const pkgJsonPath = requireFn.resolve('@anthropic-ai/claude-code/package.json');
  const pkg = requireFn('@anthropic-ai/claude-code/package.json') as {
    bin?: string | Record<string, string>;
  };
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.claude;
  if (!bin) throw new Error('claude bin not found in @anthropic-ai/claude-code');
  const resolved = path.join(path.dirname(pkgJsonPath), bin);
  // A `.js`/`.cjs`/`.mjs` entry is a Node script; anything else (the native
  // `.exe` launcher) is a standalone executable run directly.
  const viaNode = /\.(c|m)?js$/.test(resolved);
  return { path: resolved, viaNode };
}

type Run = { ok: true; stdout: string } | { ok: false; detail: string };

function runClaude(prompt: string): Promise<Run> {
  return new Promise(resolve => {
    let cli: { path: string; viaNode: boolean };
    try {
      cli = resolveClaudeCli();
    } catch (e) {
      resolve({ ok: false, detail: (e as Error).message });
      return;
    }
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_CODE_OAUTH_TOKEN:
        claudeOAuthToken.value() || process.env.CLAUDE_CODE_OAUTH_TOKEN,
      CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR ?? '/tmp/claude-config',
      IS_SANDBOX: process.env.IS_SANDBOX ?? '1',
    };
    delete env.NODE_OPTIONS;
    const cliArgs = [
      '--print',
      '--output-format',
      'json',
      '--model',
      MODEL,
      '--dangerously-skip-permissions',
      '--disallowed-tools',
      DISALLOWED_TOOLS,
      '--append-system-prompt',
      SYSTEM_PROMPT,
    ];
    // Native binary → exec directly; legacy JS entry → run under this Node.
    const [command, args] = cli.viaNode
      ? [process.execPath, [cli.path, ...cliArgs]]
      : [cli.path, cliArgs];
    const child = spawn(command, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    let done = false;
    const finish = (r: Run) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ ok: false, detail: 'timeout' });
    }, TIMEOUT_MS);
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (err += d));
    child.on('error', e => finish({ ok: false, detail: e.message }));
    child.on('close', c =>
      finish(
        c === 0
          ? { ok: true, stdout: out }
          : { ok: false, detail: `exit ${c}: ${(err || out).slice(-400)}` }
      )
    );
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function resultToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return JSON.stringify(value);
}

function parseEnvelope(stdout: string): Record<string, unknown> | null {
  const t = stdout.trim();
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    const lines = t.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i].trim();
      if (l.startsWith('{') && l.endsWith('}')) {
        try {
          return JSON.parse(l) as Record<string, unknown>;
        } catch {
          // keep scanning
        }
      }
    }
    return null;
  }
}

function extractFindings(
  resultText: string,
  lineCount: number
): { findings: DebugFinding[]; summary: string } | null {
  const m = resultText.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(m[0]);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as { buggyLines?: unknown; summary?: unknown };
  if (!Array.isArray(obj.buggyLines)) return null;
  const findings: DebugFinding[] = [];
  for (const raw of obj.buggyLines) {
    if (typeof raw !== 'object' || raw === null) continue;
    const c = raw as { line?: unknown; reason?: unknown };
    const line = Number(c.line);
    if (!Number.isInteger(line) || line < 1 || line > lineCount) continue;
    findings.push({ line, reason: typeof c.reason === 'string' ? c.reason : '' });
  }
  return {
    findings,
    summary: typeof obj.summary === 'string' ? obj.summary : '',
  };
}

export const debugCode = onCall<DebugRequest, Promise<DebugResult>>(
  { region: 'europe-west1', timeoutSeconds: 300, memory: '1GiB', maxInstances: 3 },
  async (request): Promise<DebugResult> => {
    // Native auth: onCall verifies the Firebase ID token; require a registered user.
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    if (request.auth.token.registered !== true) {
      throw new HttpsError('permission-denied', 'not-registered');
    }
    const data = request.data;
    if (typeof data?.code !== 'string' || data.code.trim() === '') {
      throw new HttpsError('invalid-argument', 'missing-code');
    }
    if (data.language !== 'cpp' && data.language !== 'java' && data.language !== 'py') {
      throw new HttpsError('invalid-argument', 'invalid-language');
    }

    const lineCount = data.code.slice(0, MAX_CODE).split('\n').length;
    const run = await runClaude(buildPrompt(data));
    if (!run.ok) {
      // Log the raw detail server-side only; never leak CLI diagnostics to the client.
      logger.error('[ai-debug] claude failed', run.detail);
      throw new HttpsError('internal', 'claude-failed');
    }
    const env = parseEnvelope(run.stdout);
    if (!env || env.is_error) {
      logger.error('[ai-debug] model error', { stdout: run.stdout.slice(0, 400) });
      throw new HttpsError('internal', 'model-error');
    }
    const extracted = extractFindings(resultToString(env.result), lineCount);
    if (!extracted) {
      logger.error('[ai-debug] unparseable findings', {
        result: resultToString(env.result).slice(0, 400),
      });
      throw new HttpsError('internal', 'unparseable-findings');
    }
    logger.info('[ai-debug] success', {
      model: MODEL,
      findings: extracted.findings.length,
      costUsd: env.total_cost_usd,
    });
    return {
      findings: extracted.findings,
      summary: extracted.summary,
      model: MODEL,
    };
  }
);
