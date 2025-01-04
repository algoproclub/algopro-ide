import { getFunctions, httpsCallable } from 'firebase/functions';
import React from 'react';
import { StatusData } from '../types/problem';

const registerSubmissionHttps = httpsCallable<unknown, { success: boolean }>(
  getFunctions(undefined, 'europe-west1'),
  'registersubmission'
);

export const registerSubmission = (
  fileID: string,
  submissionID: string,
  username: string | null,
  setStatusData: React.Dispatch<React.SetStateAction<StatusData | null>>
) => {
  setStatusData({
    statusCode: 'starting',
    message: 'starting',
    statusText: null,
    link: null,
    time: null,
    memory: null,
    output: null,
    testCases: null,
  });
  registerSubmissionHttps({
    fileID: fileID,
    submissionID: submissionID,
    username: username,
  }).then(response => {
    if (!response.data.success) {
      setStatusData({
        statusCode: 'error',
        message: 'Failed to register submission, please try again',
        statusText: null,
        link: null,
        time: null,
        memory: null,
        output: null,
        testCases: null,
      });
    }
  });
};
