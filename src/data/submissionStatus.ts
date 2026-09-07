import type { StatusData } from '../types/problem';

export type SubmissionOutcome =
  | 'accepted'
  | 'incorrect'
  | 'compile-error'
  | 'runtime-error'
  | 'time-limit'
  | 'memory-limit'
  | 'partial'
  | 'submission-error'
  | 'untried';

export const getVerdictOutcome = (
  message: string | null | undefined
): SubmissionOutcome => {
  const verdict = message?.toLowerCase() ?? '';
  if (!verdict) return 'submission-error';
  if (verdict === 'correct answer' || verdict === 'accepted') return 'accepted';
  if (verdict.includes('compil')) return 'compile-error';
  if (verdict.includes('runtime')) return 'runtime-error';
  if (verdict.includes('time limit')) return 'time-limit';
  if (verdict.includes('memory limit')) return 'memory-limit';
  if (verdict.includes('partial') || verdict.startsWith('[')) return 'partial';
  if (
    verdict.includes('internal') ||
    verdict.includes('unknown') ||
    verdict === '?'
  )
    return 'submission-error';
  return 'incorrect';
};

export const getSubmissionOutcome = ({
  message,
  statusCode,
}: StatusData): SubmissionOutcome => {
  if (statusCode === 'error') return 'submission-error';
  if (statusCode !== 'resolved') return 'untried';
  return getVerdictOutcome(message);
};

export const isSubmissionPending = ({ statusCode }: StatusData) =>
  statusCode === 'starting' || statusCode === 'working';
