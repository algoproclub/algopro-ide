import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Language } from '../context/EditorContext';

export type DebugFinding = { line: number; reason: string };

/** The callable returns the findings directly and throws HttpsError on failure. */
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
};

/**
 * Ask the backend AI debugger which lines look buggy. This calls the
 * `debugCode` Firebase 2nd-gen callable (europe-west1), which spawns the bundled
 * `claude` CLI. Auth is carried natively by onCall (the signed-in Firebase user),
 * so no idToken plumbing is needed. On failure the callable throws an
 * HttpsError, which httpsCallable surfaces as a thrown FunctionsError — callers
 * catch it and show a toast.
 */
export async function requestDebug(
  params: DebugRequestParams
): Promise<DebugResult> {
  const callable = httpsCallable<DebugRequestParams, DebugResult>(
    getFunctions(undefined, 'europe-west1'),
    'debugCode'
  );
  const { data } = await callable(params);
  return data;
}
