// Source: https://javascript.info/regexp-groups

import firebase from 'firebase/app';

const db = firebase.database();
export const extractJavaFilename = (code: string): string => {
  const matches = Array.from(code.matchAll(/public +class +(\w+)/g));
  if (matches.length > 0) {
    return matches[0][1] + '.java';
  }
  return 'Main.java'; // fallback, something went wrong
};

export const startUpdatingResults = async (
  fileID: string,
  submissionID: string,
  username?: string
) => {
  const defaultStatusData = {
    statusCode: -8,
    statusText: 'status-working',
    message: 'starting',
  };
  await db.ref(`files/${fileID}/submission`).update({
    id: submissionID,
    username: username ?? null,
  });
  await db.ref('submissions').update({
    [fileID]: {
      statusData: defaultStatusData,
    },
  });
  await db.ref('submissions/pending').update({
    [fileID]: {
      creationTime: Date.now(),
    },
  });
};

export const submitToJudge = (
  language: 'cpp' | 'java' | 'py',
  code: string,
  input: string,
  compilerOptions: string,
  fileIOName?: string
): Promise<Response> => {
  const data = {
    sourceCode: code,
    filename: {
      cpp: 'main.cpp',
      java: extractJavaFilename(code),
      py: 'main.py',
    }[language],
    language,
    input,
    compilerOptions: compilerOptions,
    ...(fileIOName
      ? {
          fileIOName,
        }
      : {}),
  };
  return fetch(
    `https://ggzk2rm2ad.execute-api.us-west-1.amazonaws.com/Prod/execute`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );
};
