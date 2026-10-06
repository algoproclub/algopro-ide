import { Platform, StatusCode } from '../../src/types/problem';

export type AccountData = {
  sessionCookie?: () => Promise<string>;
};

export type PendingSubmission = {
  submissionID: string;
  platform: Platform;
  problemID: string;
  submissionTime: number;
  username?: string | null;
  tournamentID?: string | null;
};

export type PendingSubmissions = {
  [fileID: string]: PendingSubmission;
};

export type TournamentResult = {
  message: string | null;
  statusCode: StatusCode;
  submissionTime: number;
};

export type SubmissionData = PendingSubmission & {
  fileID: string;
  sessionCookie: string | null;
};
