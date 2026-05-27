import { useEffect, useReducer } from 'react';
import type { CodeRun } from '../scripts/codeRun';
import { CODE_RUN_TIMEOUT_MS } from '../scripts/codeRun';
import useServerTimeOffset from './useServerTimeOffset';

export default function useCodeRunActive(
  codeRun: CodeRun | null | undefined
): boolean {
  const serverTimeOffset = useServerTimeOffset();
  const [, forceRefresh] = useReducer(count => count + 1, 0);
  const codeRunEndTime =
    typeof codeRun?.startedAt === 'number'
      ? codeRun.startedAt + CODE_RUN_TIMEOUT_MS
      : null;

  useEffect(() => {
    if (codeRunEndTime === null) {
      return;
    }

    const msUntilTimeout = codeRunEndTime - (Date.now() + serverTimeOffset);
    if (msUntilTimeout <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => forceRefresh(), msUntilTimeout);

    return () => window.clearTimeout(timeout);
  }, [codeRunEndTime, forceRefresh, serverTimeOffset]);

  const estimatedServerNow = Date.now() + serverTimeOffset;

  return codeRunEndTime !== null && estimatedServerNow < codeRunEndTime;
}
