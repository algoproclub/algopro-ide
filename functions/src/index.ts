import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineString } from 'firebase-functions/params';
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
import { Pending, PlatformData, SubmissionData } from './types';

admin.initializeApp({
  databaseURL: 'http://localhost:9000/?ns=algopro-app-default-rtdb',
});
const db = admin.database();
export class IncorrectDataError extends Error {}

export const cfAPIKey = defineString('CF_API_KEY');
export const cfAPISecret = defineString('CF_API_SECRET');
export const atCoderCookie = defineString('ATCODER_COOKIE');
export const csesCookie = defineString('CSES_COOKIE');

const accountData: { [key in Platform]: PlatformData } = {
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
  const updates: { [k: string]: StatusData | null } = {};
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
    if (error instanceof IncorrectDataError) {
      await updateStatusData(fileID, {
        statusCode: -1,
        statusText: 'status-done',
        message: 'incorrect data',
      });
    } else {
      await updateStatusData(fileID, {
        statusCode: -1,
        statusText: 'status-done',
        message: 'incorrect data',
      });
    }
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
  if (!username) {
    throw new Error('username is needed for CF submissions');
  }
  const resp = await fetch(
    getCFRequestURL('user.status', {
      handle: username,
    })
  );
  if (resp.status === 400) {
    submissionDataList.forEach(submissionData => {
      updateStatusData(submissionData.fileID, {
        statusCode: -1,
        statusText: 'status-done',
        message: 'unknown error',
      });
    });
  }
  if (resp.status !== 200) {
    submissionDataList.forEach(submissionData => {
      updateStatusData(submissionData.fileID, {
        statusCode: -1,
        statusText: 'status-done',
        message: 'unknown error',
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

const updateResults = async (pending: Pending) => {
  const readSubmissionData = async (pending: Pending) => {
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
    (accumulator: { [k: string]: SubmissionData[] }, data) => {
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
