import { StatusCode } from '../../src/types/problem';

export type AccountData = {
  sessionCookie?: () => Promise<string>;
};

export type PendingSubmission = {
  creationTime: number;
};

export type PendingSubmissions = {
  [key: string]: PendingSubmission;
};

export type TournamentResult = {
  message: string | null;
  statusCode: StatusCode;
  submissionTime: number;
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
