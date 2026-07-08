import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

/**
 * AI "Debug" as a 2nd-gen callable. The bug analysis is a single-turn
 * prompt → JSON call, so it goes straight to the OpenRouter chat-completions
 * API (Anthropic models under the hood) — no CLI to spawn, no extra memory,
 * and much cheaper per request than the previous claude-CLI approach (no
 * agent system-prompt overhead). The client calls it with
 * httpsCallable(getFunctions(undefined,'europe-west1'), 'debugCode'); onCall
 * verifies the Firebase ID token for us (request.auth), so the auth gating is
 * native.
 */
export const openRouterApiKey = defineString('OPENROUTER_API_KEY');

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
/**
 * Short aliases (kept from the CLI era so env overrides stay stable) mapped to
 * OpenRouter model slugs. Anything not in the map is passed through verbatim,
 * so DEBUG_MODEL can also be a full slug like `anthropic/claude-haiku-4.5`.
 */
const MODEL_ALIASES: Record<string, string> = {
  sonnet: 'anthropic/claude-sonnet-5',
  opus: 'anthropic/claude-opus-4.8',
  haiku: 'anthropic/claude-haiku-4.5',
};
const MODEL =
  process.env.DEBUG_MODEL ?? process.env.DEBUG_CLAUDE_MODEL ?? 'sonnet';
const OUTPUT_LANGUAGE = process.env.DEBUG_OUTPUT_LANGUAGE ?? 'Hungarian';
const TIMEOUT_MS = Number(
  process.env.DEBUG_TIMEOUT_MS ?? process.env.DEBUG_CLAUDE_TIMEOUT_MS ?? 120_000
);
const MAX_CODE = 60_000;
const MAX_STATEMENT = 20_000;
/** Output is a small JSON object; bounded so a runaway reply can't balloon cost. */
const MAX_OUTPUT_TOKENS = Number(process.env.DEBUG_MAX_OUTPUT_TOKENS ?? 4_096);
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
  `The student is ${OUTPUT_LANGUAGE}-speaking: write every "reason" and the "summary" in`,
  `${OUTPUT_LANGUAGE} — natural, fluent ${OUTPUT_LANGUAGE} — regardless of the`,
  'language of the problem statement or code. Keep the JSON keys, code',
  'identifiers and line numbers unchanged. Report line numbers exactly as shown.',
  'Respond with ONLY a single JSON object, no markdown fences, of the form:',
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

type Run =
  | { ok: true; content: string; costUsd: number; totalTokens: number }
  | { ok: false; detail: string };

/**
 * One OpenRouter chat-completions call: system prompt + user prompt, bounded
 * output, hard timeout. Every failure mode stays distinct in `detail` (timeout
 * vs network vs HTTP status vs malformed body) so server logs can tell a
 * pipeline failure from a model one.
 */
async function runModel(prompt: string): Promise<Run> {
  const key = openRouterApiKey.value() || process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, detail: 'missing OPENROUTER_API_KEY' };
  let resp: Response;
  try {
    resp = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_ALIASES[MODEL] ?? MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const err = e as Error;
    return {
      ok: false,
      detail: err.name === 'TimeoutError' ? 'timeout' : `fetch: ${err.message}`,
    };
  }
  const bodyText = await resp.text();
  if (!resp.ok) {
    return {
      ok: false,
      detail: `http ${resp.status}: ${bodyText.slice(0, 400)}`,
    };
  }
  let body: {
    choices?: { message?: { content?: unknown } }[];
    usage?: { cost?: unknown; total_tokens?: unknown };
    error?: { message?: unknown };
  };
  try {
    body = JSON.parse(bodyText) as typeof body;
  } catch {
    return { ok: false, detail: `unparseable body: ${bodyText.slice(0, 400)}` };
  }
  if (body.error) {
    return {
      ok: false,
      detail: `api error: ${String(body.error.message).slice(0, 400)}`,
    };
  }
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    return {
      ok: false,
      detail: `no completion content: ${bodyText.slice(0, 400)}`,
    };
  }
  return {
    ok: true,
    content,
    costUsd: Number(body.usage?.cost) || 0,
    totalTokens: Number(body.usage?.total_tokens) || 0,
  };
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
  {
    region: 'europe-west1',
    timeoutSeconds: 300,
    memory: '256MiB',
    maxInstances: 3,
  },
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
    const run = await runModel(buildPrompt(data));
    if (!run.ok) {
      // Log the raw detail server-side only; never leak API diagnostics to the client.
      logger.error('[ai-debug] model call failed', run.detail);
      throw new HttpsError('internal', 'model-failed');
    }
    const extracted = extractFindings(run.content, lineCount);
    if (!extracted) {
      logger.error('[ai-debug] unparseable findings', {
        result: run.content.slice(0, 400),
      });
      throw new HttpsError('internal', 'unparseable-findings');
    }
    logger.info('[ai-debug] success', {
      model: MODEL,
      findings: extracted.findings.length,
      costUsd: run.costUsd,
      totalTokens: run.totalTokens,
    });
    return {
      findings: extracted.findings,
      summary: extracted.summary,
      model: MODEL,
    };
  }
);
