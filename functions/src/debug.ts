import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

/**
 * AI "Debug" as a 2nd-gen callable. The bug analysis is a single-turn
 * prompt → JSON call made directly to a provider API — no CLI to spawn, no
 * extra memory, and much cheaper per request than the earlier claude-CLI
 * approach (no agent system-prompt overhead). The provider is swappable via
 * DEBUG_PROVIDER (openrouter | anthropic | openai); by default the first
 * provider whose API key is configured wins, in that order. OpenRouter and
 * OpenAI share the OpenAI chat-completions wire format; Anthropic uses its
 * native Messages API. The client calls it with
 * httpsCallable(getFunctions(undefined,'europe-west1'), 'debugCode'); onCall
 * verifies the Firebase ID token for us (request.auth), so the auth gating is
 * native.
 */
export const openRouterApiKey = defineString('OPENROUTER_API_KEY');
export const anthropicApiKey = defineString('ANTHROPIC_API_KEY');
// OPENAI_API_KEY is already declared as a param in index.ts; at runtime its
// value is available via process.env like every gen-2 param.

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
type ProviderName = 'openrouter' | 'anthropic' | 'openai';
type Provider = {
  url: string;
  /** Resolve the configured API key (param first, then plain env). */
  key: () => string;
  /**
   * Tier aliases (kept from the CLI era so env overrides stay stable) mapped
   * to this provider's model ids. Anything not in the map passes through
   * verbatim, so DEBUG_MODEL can also be a full provider-specific model id.
   */
  aliases: Record<string, string>;
  /** Wire format: OpenAI chat-completions or Anthropic Messages. */
  format: 'chat-completions' | 'anthropic-messages';
};

const PROVIDERS: Record<ProviderName, Provider> = {
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: () => openRouterApiKey.value() || process.env.OPENROUTER_API_KEY || '',
    aliases: {
      sonnet: 'anthropic/claude-sonnet-5',
      opus: 'anthropic/claude-opus-4.8',
      haiku: 'anthropic/claude-haiku-4.5',
    },
    format: 'chat-completions',
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    key: () => anthropicApiKey.value() || process.env.ANTHROPIC_API_KEY || '',
    aliases: {
      sonnet: 'claude-sonnet-5',
      opus: 'claude-opus-4-8',
      haiku: 'claude-haiku-4-5',
    },
    format: 'anthropic-messages',
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    key: () => process.env.OPENAI_API_KEY || '',
    aliases: {
      sonnet: 'gpt-5.1',
      opus: 'gpt-5.1',
      haiku: 'gpt-5-mini',
    },
    format: 'chat-completions',
  },
};

/**
 * Provider selection: explicit DEBUG_PROVIDER wins; otherwise the first
 * provider (openrouter → anthropic → openai) with a configured key. Falls
 * back to openrouter so a missing key still fails with a clear
 * "missing API key" error rather than an undefined provider.
 */
function pickProvider(): ProviderName {
  const forced = (process.env.DEBUG_PROVIDER ?? '').toLowerCase();
  if (forced === 'openrouter' || forced === 'anthropic' || forced === 'openai') {
    return forced;
  }
  for (const name of ['openrouter', 'anthropic', 'openai'] as ProviderName[]) {
    if (PROVIDERS[name].key()) return name;
  }
  return 'openrouter';
}

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
 * One provider call: system prompt + user prompt, bounded output, hard
 * timeout. OpenRouter/OpenAI use the chat-completions format; Anthropic its
 * native Messages API. Every failure mode stays distinct in `detail` (timeout
 * vs network vs HTTP status vs malformed body) so server logs can tell a
 * pipeline failure from a model one. `costUsd` is reported only by OpenRouter;
 * 0 means "not reported by this provider".
 */
async function runModel(
  prompt: string,
  providerName: ProviderName
): Promise<Run> {
  const provider = PROVIDERS[providerName];
  const key = provider.key();
  if (!key) return { ok: false, detail: `missing API key for ${providerName}` };
  const model = provider.aliases[MODEL] ?? MODEL;
  const anthropic = provider.format === 'anthropic-messages';
  let resp: Response;
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
              model,
              max_tokens: MAX_OUTPUT_TOKENS,
              system: SYSTEM_PROMPT,
              messages: [{ role: 'user', content: prompt }],
            }
          : {
              model,
              max_tokens: MAX_OUTPUT_TOKENS,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
              ],
            }
      ),
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
    // chat-completions shape (OpenRouter / OpenAI)
    choices?: { message?: { content?: unknown } }[];
    usage?: {
      cost?: unknown;
      total_tokens?: unknown;
      input_tokens?: unknown;
      output_tokens?: unknown;
    };
    error?: { message?: unknown };
    // anthropic-messages shape
    content?: { type?: unknown; text?: unknown }[];
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
  // Anthropic content is a block array (a thinking block may precede the
  // text block on adaptive-thinking models); chat-completions is a string.
  const content = anthropic
    ? body.content?.find(b => b.type === 'text')?.text
    : body.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    return {
      ok: false,
      detail: `no completion content: ${bodyText.slice(0, 400)}`,
    };
  }
  const n = (v: unknown): number =>
    typeof v === 'number' ? v : Number(v) || 0;
  return {
    ok: true,
    content,
    costUsd: n(body.usage?.cost),
    totalTokens: anthropic
      ? n(body.usage?.input_tokens) + n(body.usage?.output_tokens)
      : n(body.usage?.total_tokens),
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
    const provider = pickProvider();
    const run = await runModel(buildPrompt(data), provider);
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
      provider,
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
