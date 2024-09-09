import { defineString } from 'firebase-functions/params';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Change, logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  FileSubmission,
  Platform,
  ProblemData,
  ProblemSolution,
  StatusData,
  SubmissionData as ClientSubmissionData,
} from '../../src/types/problem';
import {
  getCFRequestURL,
  CFResultFetcher,
  AtCoderResultFetcher,
  ResultFetcher,
  CSESResultFetcher,
  SPOJResultFetcher,
  PlanetsResultFetcher,
} from './getResult';
import { PendingSubmissions, AccountData, SubmissionData } from './types';
import {
  DatabaseEvent,
  onValueCreated,
  onValueDeleted,
  onValueUpdated,
  onValueWritten,
} from 'firebase-functions/v2/database';

import { randomUUID } from 'crypto';
import {
  AtCoderSubmitter,
  CFSubmitter,
  CSESSubmitter,
  PlanetsSubmitter,
  SPOJSubmitter,
  Submitter,
} from './submit';
import { JSDOM } from 'jsdom';
import { ParamsOf } from 'firebase-functions/lib/common/params';
import { database } from 'firebase-admin';
import DataSnapshot = database.DataSnapshot;
import { getFirestore } from 'firebase-admin/firestore';

require('dotenv').config({ path: '.env.local' });

export const cfAPIKey = defineString('CF_API_KEY');
export const deeplAPIKey = defineString('DEEPL_API_KEY');
export const cfAPISecret = defineString('CF_API_SECRET');

export const loginBotUrl = defineString('LOGIN_BOT_URL');

const PENDING_TIME_LIMIT_MS = 300000;
const INCORRECT_DATA_RETRY_LIMIT_MS = 20000;

export const submitproblemsolution = onCall<
  ProblemSolution,
  Promise<ClientSubmissionData>
>(
  { region: 'europe-west1', maxInstances: 1, concurrency: 1 },
  async request => {
    const problemSolution = request.data;
    const { platform, language } = problemSolution;
    const comment = {
      cpp: '//',
      java: '//',
      py: '#',
    }[language];

    const uuid = randomUUID();
    problemSolution.sourceCode =
      `${comment} UUID: ${uuid}\n` + problemSolution.sourceCode;

    let submitter: Submitter;
    switch (platform) {
      case 'codeforces':
        submitter = new CFSubmitter();
        break;
      case 'atcoder':
        submitter = new AtCoderSubmitter();
        break;
      case 'cses':
        submitter = new CSESSubmitter();
        break;
      case 'spoj':
        submitter = new SPOJSubmitter();
        break;
      case 'planets':
        submitter = new PlanetsSubmitter(
          request.rawRequest.headers.authorization ?? ''
        );
        break;
      default:
        throw new HttpsError(
          'unimplemented',
          `platform '${platform}' is unimplemented`
        );
    }
    await submitter.login(db);
    return await submitter.submit(problemSolution, uuid);
  }
);

export const translate = onCall<
  {
    text: string;
    lang: string;
  },
  Promise<string | null>
>({ region: 'europe-west1' }, async request => {
  if (!request.auth?.token?.teacher) {
    return null;
  }
  let { text, lang } = request.data;

  const document = new JSDOM(text).window.document;
  for (const el of document.getElementsByTagName('pre'))
    el.setAttribute('translate', 'no');
  text = document.body.innerHTML;

  const resp = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${deeplAPIKey.value()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text],
      tag_handling: 'html',
      target_lang: lang,
    }),
  });
  let translation: string | null = null;
  try {
    const json = await resp.json();
    translation = json['translations'][0].text ?? null;
  } catch (error) {
    logger.log(error);
  }
  return translation;
});

export const enum Errors {
  NO_SUCH_SUBMISSION = 'No such submission exists for the given problem. Please check if the entered submission ID is correct.',
  UNKNOWN_ERROR = 'Could not retrieve the submission results due to an unknown error',
  PENDING_TIMEOUT = 'Could not retreive the submission results in time. Please try again later.',
}

export class IncorrectDataError extends Error {}

admin.initializeApp(
  process.env.FUNCTIONS_EMULATOR
    ? {
        projectId: 'algopro-app',
        databaseURL: 'http://firebase:9000?ns=algopro-app-default-rtdb',
      }
    : undefined
);
const db = admin.database();

const accountData: { [key in Platform]: AccountData } = {
  atcoder: {
    // result fetching always uses the first account
    sessionCookie: async () =>
      (await db.ref('credentials/atcoder/0/cookie').get()).val(),
  },
  cses: {
    sessionCookie: async () =>
      (await db.ref('credentials/cses/0/cookie').get()).val(),
  },
  codeforces: {},
  planets: {},
  usaco: {},
  spoj: {
    sessionCookie: async () =>
      (await db.ref('credentials/spoj/0/cookie').get()).val(),
  },
};

const updateStatusData = async (
  id: string,
  statusData: Partial<StatusData>
) => {
  const updates: { [key: string]: Partial<StatusData> | null | boolean } = {};
  updates[`submissions/${id}/statusData`] = statusData;

  if (['error', 'resolved'].includes(statusData.statusCode!)) {
    updates[`submissions/pending/${id}`] = null;
  }
  if (statusData.message === 'correct answer') {
    updates[`files/${id}/solvedStatus/solved`] = true;
  }
  await db.ref().update(updates);
};

const getAndUpdate = async (fetcher: ResultFetcher, fileID: string) => {
  try {
    const data = await fetcher.getResults();
    await updateStatusData(fileID, data);
  } catch (error) {
    let message = Errors.UNKNOWN_ERROR;
    if (error instanceof IncorrectDataError) {
      if (
        fetcher.submissionData.creationTime >
        Date.now() - INCORRECT_DATA_RETRY_LIMIT_MS
      ) {
        return;
      }
      message = Errors.NO_SUCH_SUBMISSION;
    }
    logger.log(error);
    await updateStatusData(fileID, {
      statusCode: 'error',
      statusText: 'status-done',
      message: message,
    });
  }
};

const updateResultNonCF = async (submissionData: SubmissionData) => {
  let fetcher: ResultFetcher;
  if (submissionData.platform === 'cses') {
    fetcher = new CSESResultFetcher(submissionData);
  } else if (submissionData.platform === 'atcoder') {
    fetcher = new AtCoderResultFetcher(submissionData);
  } else if (submissionData.platform === 'spoj') {
    fetcher = new SPOJResultFetcher(submissionData);
  } else if (submissionData.platform === 'planets') {
    fetcher = new PlanetsResultFetcher(submissionData);
  } else {
    throw new Error(`invalid platform name (${submissionData.platform})`);
  }
  await getAndUpdate(fetcher, submissionData.fileID);
};

const updateResultsCF = async (
  submissionDataList: SubmissionData[] | undefined
) => {
  if (!submissionDataList || submissionDataList.length === 0) {
    return;
  }
  const sorted = submissionDataList.sort(
    (a, b) => a.creationTime - b.creationTime
  );
  const username = sorted[0].username;
  submissionDataList = submissionDataList.filter(
    submissionData => submissionData.username === username
  );

  const url = getCFRequestURL('user.status', {
    handle: username,
  });
  const resp = await fetch(url);
  const promises: Promise<void>[] = [];
  if (resp.status !== 200) {
    logger.log(
      `CF: response status is not 200; url: ${url}; response status: ${resp.status}`
    );
    submissionDataList.forEach(submissionData => {
      promises.push(
        updateStatusData(submissionData.fileID, {
          statusCode: 'error',
          statusText: 'status-done',
          message:
            resp.status === 400
              ? Errors.NO_SUCH_SUBMISSION
              : Errors.UNKNOWN_ERROR,
        })
      );
    });
  } else {
    const resultJSON = ((await resp.json()) as any)['result'];
    submissionDataList.forEach(submissionData => {
      promises.push(
        getAndUpdate(
          new CFResultFetcher(submissionData, resultJSON),
          submissionData.fileID
        )
      );
    });
  }
  await Promise.all(promises);
};

const updateResults = async (pending: PendingSubmissions | null) => {
  const readSubmissionData = async (pending: PendingSubmissions) => {
    const submissionData: SubmissionData[] = [];
    for (const fileID of Object.keys(pending)) {
      try {
        const creationTime = pending[fileID].creationTime;
        const fileData: { problem: ProblemData; submission: FileSubmission } = (
          await db.ref(`files/${fileID}`).get()
        ).val();
        const platform = fileData.problem.platform;
        const problemID = fileData.problem.id;
        const submissionID = fileData.submission.id;
        const username = fileData.submission.username ?? null;

        submissionData.push({
          fileID: fileID,
          platform: platform,
          username: username,
          sessionCookie:
            (await accountData[platform].sessionCookie?.()) ?? null,
          problemID: problemID,
          submissionID: submissionID,
          creationTime: creationTime,
        });
      } catch (error) {
        await updateStatusData(fileID, {
          statusCode: 'error',
          statusText: 'status-done',
          message: Errors.NO_SUCH_SUBMISSION,
        });
        logger.log(error);
      }
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
  for (const platform of ['cses', 'atcoder', 'spoj', 'planets']) {
    pendingByPlatform[platform]?.forEach(obj => {
      promises.push(updateResultNonCF(obj));
    });
  }
  promises.push(updateResultsCF(pendingByPlatform['codeforces']));
  await Promise.all(promises);
};

const registerSubmission = async (
  fileID: string,
  submissionID: string,
  username: string | null
) => {
  const defaultStatusData: StatusData = {
    statusCode: 'starting',
    statusText: 'status-working',
    message: 'starting',
    link: null,
    time: null,
    memory: null,
    output: null,
    testCases: null,
  };
  await db.ref(`files/${fileID}/submission`).update({
    id: submissionID,
    username: username,
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

exports.registersubmission = onCall(
  { region: 'europe-west1' },
  async request => {
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
      fileData.users[userID].permission ??
      fileData?.settings?.defaultPermission;

    if (!['OWNER', 'READ_WRITE'].includes(permission)) {
      return { success: false };
    }
    await registerSubmission(
      fileID,
      request.data.submissionID,
      request.data.username
    );
    return { success: true };
  }
);

const updateStatus = async () => {
  const pending = (await db.ref('submissions/pending').get()).val();
  if (!pending) {
    return;
  }
  let startNewUpdate = false;
  await db.ref('submissions/lock').transaction((lock?: boolean) => {
    startNewUpdate = !lock;
    return true;
  });
  if (!startNewUpdate) {
    return;
  }
  try {
    await new Promise(r => setTimeout(r, 2000));
    const pending: PendingSubmissions = (
      await db.ref('submissions/pending').get()
    ).val();
    const cutoff = Date.now() - PENDING_TIME_LIMIT_MS;

    const filtered: PendingSubmissions = {};
    const promises: Promise<void>[] = [];

    Object.entries(pending).forEach((entry, index) => {
      const fileID = entry[0];
      const creationTime = entry[1].creationTime;

      if (creationTime <= cutoff) {
        promises.push(
          updateStatusData(fileID, {
            statusCode: 'error',
            statusText: 'status-done',
            message: Errors.PENDING_TIMEOUT,
          })
        );
      } else {
        filtered[fileID] = {
          creationTime,
        };
      }
    });
    await Promise.all(promises);
    await updateResults(filtered);
  } catch (error) {
    logger.log(error);
  } finally {
    await db.ref('submissions/lock').set(null);
  }
};

const handleSolve = async (
  event: DatabaseEvent<
    Change<DataSnapshot>,
    ParamsOf<'files/{fileID}/solvedStatus/solved'>
  >
) => {
  const fileID = event.params.fileID;
  const userID = Object.entries(
    (await db.ref(`files/${fileID}/users`).get()).val()
  )
    .find(([_, v]: [string, any]) => {
      return v.permission === 'OWNER';
    })
    ?.at(0);
  const { platform, id } = (
    await db.ref(`files/${fileID}/problem`).get()
  ).val();
  await getFirestore()
    .doc(`problemsets/${platform}/problems/${id}/solvedStatus/${userID}`)
    .set({
      solved: event.data.after.val(),
    });
};

const region = process.env.IS_TEST_ENV ? 'us-central1' : 'europe-west1';

exports.onlockdeleted = onValueDeleted(
  { ref: 'submissions/lock', region },
  updateStatus
);
exports.onpendingcreated = onValueCreated(
  { ref: 'submissions/pending', region },
  updateStatus
);
exports.onpendingupdated = onValueUpdated(
  { ref: 'submissions/pending', region },
  updateStatus
);
exports.onsolve = onValueWritten(
  { ref: 'files/{fileID}/solvedStatus/solved', region },
  handleSolve
);
