import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineString } from 'firebase-functions/params';
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FileData, Platform } from '../../src/context/EditorContext';
import { StatusData } from '../../src/components/Workspace/Workspace';
import {
  getCFRequestURL,
  CFResultFetcher,
  AtCoderResultFetcher,
  ResultFetcher,
  CSESResultFetcher,
} from './getResult';
import { PendingSubmission, AccountData, SubmissionData } from './types';

admin.initializeApp({
  databaseURL: 'http://localhost:9000/?ns=algopro-app-default-rtdb',
});
const db = admin.database();

export class IncorrectDataError extends Error {}

export const cfAPIKey = defineString('CF_API_KEY');
export const cfAPISecret = defineString('CF_API_SECRET');
export const atCoderCookie = defineString('ATCODER_COOKIE');
export const csesCookie = defineString('CSES_COOKIE');

const accountData: { [key in Platform]: AccountData } = {
  atcoder: {
    sessionCookie: atCoderCookie,
  },
  cses: {
    sessionCookie: csesCookie,
  },
  codeforces: {},
  planets: {},
  usaco: {},
};

const updateStatusData = async (id: string, statusData: StatusData) => {
  const updates: { [key: string]: StatusData | null } = {};
  updates[`submissions/${id}/statusData`] = statusData;
  if (statusData.statusCode > -8) {
    updates[`submissions/pending/${id}`] = null;
  }
  await db.ref().update(updates);
};

const getAndUpdate = async (fetcher: ResultFetcher, fileID: string) => {
  try {
    const data = await fetcher.getResults();
    await updateStatusData(fileID, data);
  } catch (error) {
    let message = 'Error: unknown error';
    if (error instanceof IncorrectDataError) {
      message = 'Error: incorrect data';
    }
    await updateStatusData(fileID, {
      statusCode: -1,
      statusText: 'status-done',
      message: message,
    });
  }
};

const updateResult = async (submissionData: SubmissionData) => {
  let fetcher: ResultFetcher;
  if (submissionData.platform === 'cses') {
    fetcher = new CSESResultFetcher(submissionData);
  } else if (submissionData.platform === 'atcoder') {
    fetcher = new AtCoderResultFetcher(submissionData);
  } else {
    return;
  }
  await getAndUpdate(fetcher, submissionData.fileID);
};

const updateResultsCF = async (submissionDataList: SubmissionData[]) => {
  if (!submissionDataList || submissionDataList.length === 0) {
    return;
  }
  const sorted = submissionDataList.sort(
    (a, b) => a.creationTime - b.creationTime
  );
  const username = sorted[0].username;
  const resp = await fetch(
    getCFRequestURL('user.status', {
      handle: username,
    })
  );
  if (resp.status !== 200) {
    submissionDataList.forEach(submissionData => {
      updateStatusData(submissionData.fileID, {
        statusCode: -1,
        statusText: 'status-done',
        message:
          resp.status === 400
            ? 'Error: incorrect data'
            : 'Error: unknown error',
      });
    });
  }
  const resultJSON = ((await resp.json()) as any)['result'];
  const promises: Promise<void>[] = [];
  submissionDataList.forEach(submissionData => {
    promises.push(
      getAndUpdate(
        new CFResultFetcher(submissionData, resultJSON),
        submissionData.fileID
      )
    );
  });
  await Promise.all(promises);
};

const updateResults = async (pending: PendingSubmission) => {
  const readSubmissionData = async (pending: PendingSubmission) => {
    const submissionData: SubmissionData[] = [];
    for (let fileID of Object.keys(pending)) {
      const creationTime = pending[fileID].creationTime;
      const fileData: FileData = (await db.ref(`files/${fileID}`).get()).val();
      const platform = fileData.problem.platform;
      const problemID = fileData.problem.id;
      const submissionID = fileData.submission.id;
      const username = fileData.submission.username;

      submissionData.push({
        fileID: fileID,
        platform: platform,
        username: username,
        sessionCookie: accountData[platform]?.sessionCookie?.value(),
        problemID: problemID,
        submissionID: submissionID,
        creationTime: creationTime,
      });
    }
    return submissionData;
  };
  if (!pending) {
    return;
  }
  const pendingData = await readSubmissionData(pending);
  const pendingByPlatform = pendingData.reduce(
    (accumulator: { [key: string]: SubmissionData[] }, data) => {
      const platform = data.platform;
      if (!accumulator[platform]) {
        accumulator[platform] = [];
      }
      accumulator[platform].push(data);
      return accumulator;
    },
    {}
  );

  const promises: Promise<void>[] = [];
  pendingByPlatform['cses']?.forEach(obj => {
    promises.push(updateResult(obj));
  });
  pendingByPlatform['atcoder']?.forEach(obj => {
    promises.push(updateResult(obj));
  });
  promises.push(updateResultsCF(pendingByPlatform['codeforces']));
  await Promise.all(promises);
};

const startUpdatingResults = async (
  fileID: string,
  submissionID: string,
  username?: string
) => {
  const defaultStatusData = {
    statusCode: -100,
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

exports.startUpdatingResults = onCall(async request => {
  const fileID = request.data.fileID;
  const userID = request.auth?.uid;
  const fileData = (await db.ref(`files/${fileID}`).get()).val();
  if (
    !userID ||
    !fileData ||
    !fileData.users ||
    !fileData.users.hasOwnProperty(userID)
  ) {
    return { success: false };
  }
  const permission =
    fileData.users[userID].permission ?? fileData?.settings?.defaultPermission;
  if (!['OWNER', 'READ_WRITE'].includes(permission)) {
    return { success: false };
  }
  await startUpdatingResults(
    fileID,
    request.data.submissionID,
    request.data.username
  );
  return { success: true };
});

exports.scheduledUpdate = onSchedule('every 2 seconds', async () => {
  let startNewUpdate = false;
  await db.ref('submissions/lock').transaction((lock?: boolean) => {
    startNewUpdate = !lock;
    return true;
  });
  if (!startNewUpdate) {
    return;
  }
  try {
    await db
      .ref('submissions/pending')
      .once('value', async (snapshot: admin.database.DataSnapshot) => {
        await updateResults(snapshot.val());
      });
  } catch (error) {
    logger.log(error);
  } finally {
    await db.ref('submissions/lock').set(null);
  }
});
