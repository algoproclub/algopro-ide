import JudgeResult, { JudgeResultStatuses } from './types/judge';

export function encode(str: string | null): string {
  return btoa(unescape(encodeURIComponent(str || '')));
}

export function isFirebaseId(queryId: string): boolean {
  return (
    /^(?!\.\.?$)(?!.*__.*__)([^/]{1,1500})$/.test(queryId) &&
    queryId.length === 19
  );
}

function trimLines(output: string): string {
  return output
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trimEnd();
}

export function cleanJudgeResult(
  data: JudgeResult,
  expectedOutput?: string,
  prefix?: string
): void {
  const statusDescriptions: { [key in JudgeResultStatuses]: string } = {
    success: 'Successful',
    compile_error: 'Compilation Error',
    runtime_error: 'Runtime Error',
    internal_error: 'Internal Server Error',
    time_limit_exceeded: 'Time Limit Exceeded',
    wrong_answer: 'Wrong Answer',
  };
  data.statusDescription = statusDescriptions[data.status];
  if (data.fileOutput) {
    data.stdout = data.fileOutput;
  }
  if (expectedOutput && data.status === 'success') {
    if (data.stdout && !data.stdout.endsWith('\n')) {
      data.stdout += '\n';
    }

    if (trimLines(data.stdout ?? '') === trimLines(expectedOutput)) {
      data.statusDescription = 'Successful';
    } else {
      data.status = 'wrong_answer';
      data.statusDescription = 'Wrong Answer';
    }
  }
  if (prefix && data.status !== 'compile_error')
    // only add prefix when no compilation error
    data.statusDescription = prefix + data.statusDescription;
}
