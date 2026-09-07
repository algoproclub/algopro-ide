import JudgeResult, { JudgeResultStatuses } from './types/judge';

const statusDescriptions: Record<JudgeResultStatuses, string> = {
  success: 'Successful',
  compile_error: 'Compilation Error',
  runtime_error: 'Runtime Error',
  memory_limit_exceeded: 'Memory Limit Exceeded',
  internal_error: 'Internal Server Error',
  time_limit_exceeded: 'Time Limit Exceeded',
  wrong_answer: 'Wrong Answer',
};

const signalDescriptions: Record<number, string> = {
  4: 'Illegal instruction (SIGILL 4)',
  6: 'Aborted (SIGABRT 6)',
  8: 'Floating-point exception (SIGFPE 8)',
  9: 'Killed (SIGKILL 9)',
  11: 'Segmentation fault (SIGSEGV 11)',
  15: 'Terminated (SIGTERM 15)',
};

export function getJudgeStatusDescription(result: JudgeResult): string {
  if (result.statusDescription) return result.statusDescription;
  if (result.status === 'runtime_error' && result.signal) {
    return (
      signalDescriptions[result.signal] ??
      `Runtime Error (signal ${result.signal})`
    );
  }
  return statusDescriptions[result.status];
}

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
  expectedOutput?: string
): void {
  if (data.statusDescription === statusDescriptions[data.status]) {
    delete data.statusDescription;
  }
  if (data.fileOutput) {
    data.stdout = data.fileOutput;
    delete data.fileOutput;
  }
  if (expectedOutput && data.status === 'success') {
    if (data.stdout && !data.stdout.endsWith('\n')) {
      data.stdout += '\n';
    }

    if (trimLines(data.stdout ?? '') !== trimLines(expectedOutput)) {
      data.status = 'wrong_answer';
      delete data.statusDescription;
    }
  }
}
