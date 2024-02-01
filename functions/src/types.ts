import { StringParam } from 'firebase-functions/lib/params/types';

export type AccountData = {
  sessionCookie?: StringParam;
};

export type PendingSubmissions = {
  [key: string]: {
    creationTime: number;
  };
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
