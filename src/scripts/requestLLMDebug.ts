import { getAuth } from 'firebase/auth';
import type { Language } from '../context/EditorContext';
import type { LLMDebugResponse } from '../types/llmDebug';

export async function requestLLMDebug(
  fileId: string,
  language: Language,
  code: string
): Promise<LLMDebugResponse> {
  const user = getAuth().currentUser;
  if (!user) return { ok: false, message: 'You are not signed in.' };

  let response: Response;
  try {
    response = await fetch('/api/llmDebug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: await user.getIdToken(),
        fileId,
        language,
        code,
      }),
    });
  } catch {
    return { ok: false, message: 'A network error occurred. Try again.' };
  }
  try {
    return (await response.json()) as LLMDebugResponse;
  } catch {
    return {
      ok: false,
      message: `The server answered with HTTP ${response.status}.`,
    };
  }
}
