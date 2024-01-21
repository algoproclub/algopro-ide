import { StringParam } from 'firebase-functions/lib/params/types';

export type PlatformData = {
  sessionCookie?: StringParam;
};

export type Pending = {
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
