import { PlatformProblem, Translation } from '../../src/types/problem';

export type AccountData = {
  sessionCookie?: () => string;
};

export type PendingSubmission = {
  creationTime: number;
};

export type PendingSubmissions = {
  [key: string]: PendingSubmission;
};

export type SubmissionData = {
  fileID: string;
  platform: string;
  username: string | null;
  sessionCookie: string | null;
  problemID: string;
  submissionID: string;
  creationTime: number;
};

export type TranslationData = {
  problem: PlatformProblem;
  translation: Translation;
};
