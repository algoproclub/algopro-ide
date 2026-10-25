import { useEffect, useState } from 'react';
import type { CodeRun } from '../scripts/codeRun';
import { CODE_RUN_TIMEOUT_MS } from '../scripts/codeRun';
import useServerTimeOffset from './useServerTimeOffset';

export default function useCodeRunActive(
  codeRun: CodeRun | null | undefined
): boolean {
  const serverTimeOffset = useServerTimeOffset();
  const codeRunEndTime =
    typeof codeRun?.startedAt === 'number'
      ? codeRun.startedAt + CODE_RUN_TIMEOUT_MS
      : null;
  const [expiredEndTime, setExpiredEndTime] = useState(() =>
    codeRunEndTime !== null && codeRunEndTime <= Date.now() + serverTimeOffset
      ? codeRunEndTime
      : null
  );

  useEffect(() => {
    if (codeRunEndTime === null) {
      return;
    }

    const msUntilTimeout = codeRunEndTime - (Date.now() + serverTimeOffset);
    const timeout = window.setTimeout(
      () => setExpiredEndTime(codeRunEndTime),
      Math.max(0, msUntilTimeout)
    );

    return () => window.clearTimeout(timeout);
  }, [codeRunEndTime, serverTimeOffset]);

  return codeRunEndTime !== null && expiredEndTime !== codeRunEndTime;
}
