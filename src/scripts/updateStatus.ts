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
  const setError = (
    message = 'Failed to register submission, please try again'
  ) =>
    setStatusData({
      statusCode: 'error',
      message,
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
  })
    .then(response => {
      if (!response.data.success) setError();
    })
    .catch((error: unknown) => {
      setError(error instanceof Error ? error.message : undefined);
    });
};
