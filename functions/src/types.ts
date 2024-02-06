import { StringParam } from 'firebase-functions/lib/params/types';

export type AccountData = {
  sessionCookie?: StringParam;
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
