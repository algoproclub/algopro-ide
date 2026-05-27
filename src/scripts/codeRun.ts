import {
  getDatabase,
  push,
  ref,
  runTransaction,
  serverTimestamp,
} from 'firebase/database';

export const CODE_RUN_TIMEOUT_MS = 30_000;

export type CodeRun = {
  runID: string;
  startedAt: number;
};

function createCodeRunID(): string {
  // push() generates Firebase's standard unique key without writing data.
  return push(ref(getDatabase())).key!;
}

export async function beginCodeRun(
  fileID: string,
  serverTimeOffset: number
): Promise<string | null> {
  const runID = createCodeRunID();
  const now = Date.now() + serverTimeOffset;

  const result = await runTransaction(
    ref(getDatabase(), `files/${fileID}/codeRun`),
    current => {
      const currentRunEndTime =
        typeof current?.startedAt === 'number'
          ? current.startedAt + CODE_RUN_TIMEOUT_MS
          : null;

      if (currentRunEndTime !== null && now < currentRunEndTime) {
        return;
      }

      return {
        runID,
        startedAt: serverTimestamp(),
      };
    }
  );

  if (!result.committed) {
    return null;
  }

  return runID;
}

export async function endCodeRun(fileID: string, runID: string): Promise<void> {
  await runTransaction(
    ref(getDatabase(), `files/${fileID}/codeRun`),
    current => {
      if (current?.runID !== runID) {
        return;
      }

      return null;
    }
  );
}
