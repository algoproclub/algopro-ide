import { getAuth } from 'firebase/auth';
import type { Language } from '../context/EditorContext';

export type DebugFinding = { line: number; reason: string };

export type DebugResult = {
  findings: DebugFinding[];
  summary: string;
  model: string;
};

export type DebugRequestParams = {
  language: Language;
  code: string;
  problemTitle?: string | null;
  problemStatement?: string | null;
  /** PDF statement URL (njudge/oj.uz); the server fetches + extracts it when no inline statement is given. */
  problemStatementUrl?: string | null;
};

/** Shape of the /api/debug JSON response (success or error envelope). */
type DebugApiResponse = {
  ok?: boolean;
  error?: string;
  findings?: DebugFinding[];
  summary?: string;
  model?: string;
};

/**
 * Ask the backend AI debugger which lines look buggy. This POSTs to the
 * `/api/debug` Next.js route (it runs on Vercel in production — the earlier
 * `debugCode` Firebase callable existed only to spawn the `claude` CLI, which
 * the current direct provider-API call no longer needs). The route is
 * auth-gated: it verifies the caller's Firebase ID token and requires the
 * `registered` claim, so we mint a fresh token here. On failure it throws an
 * Error whose message is the server's stable error code (e.g. `model-timeout`);
 * callers catch it and show a toast.
 */
export async function requestDebug(
  params: DebugRequestParams
): Promise<DebugResult> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('unauthenticated');
  const idToken = await user.getIdToken();

  const resp = await fetch('/api/debug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, idToken }),
  });
  let data: DebugApiResponse | null = null;
  try {
    data = (await resp.json()) as DebugApiResponse;
  } catch {
    // Non-JSON body (e.g. a proxy error page); fall through to the code below.
  }
  if (
    !resp.ok ||
    data?.ok !== true ||
    !Array.isArray(data.findings) ||
    typeof data.summary !== 'string' ||
    typeof data.model !== 'string'
  ) {
    throw new Error(data?.error ?? `debug-http-${resp.status}`);
  }
  return { findings: data.findings, summary: data.summary, model: data.model };
}
