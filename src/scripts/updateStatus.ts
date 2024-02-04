import { DataSnapshot, getDatabase, onValue, ref } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import firebase from 'firebase/compat';
import HttpsCallableResult = firebase.functions.HttpsCallableResult;
import React from 'react';
import { StatusData } from '../types/problem';

const registerSubmissionHttps = httpsCallable(
  getFunctions(undefined, 'europe-west1'),
  'registersubmission'
);

export const resetStatusData = (
  fileID: string,
  setStatusData: React.Dispatch<React.SetStateAction<StatusData | null>>
) => {
  onValue(
    ref(getDatabase(), `submissions/${fileID}/statusData`),
    (snapshot: DataSnapshot) => {
      setStatusData(snapshot.val());
    },
    {
      onlyOnce: true,
    }
  );
};

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
  }).then((response: HttpsCallableResult) => {
    if (!response.data.success) {
      resetStatusData(fileID, setStatusData);
    }
  });
};
