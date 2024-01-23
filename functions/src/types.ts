import { StringParam } from 'firebase-functions/lib/params/types';

export type AccountData = {
  sessionCookie?: StringParam;
};

export type PendingSubmission = {
  [key: string]: {
    creationTime: number;
  };
};

export type SubmissionData = {
  fileID: string;
  platform: string;
  username?: string;
  sessionCookie?: string;
  problemID: string;
  submissionID: string;
  creationTime: number;
};
