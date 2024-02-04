import { defineString } from 'firebase-functions/params';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
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
} from './getResult';
import { PendingSubmissions, AccountData, SubmissionData } from './types';
import {
  onValueCreated,
  onValueDeleted,
  onValueUpdated,
} from 'firebase-functions/v2/database';
import { randomUUID } from 'crypto';

require('dotenv').config({ path: '.env.local' });

export const submitproblemsolution = onCall<
  ProblemSolution,
  Promise<ClientSubmissionData>
>({ region: 'europe-west1' }, async request => {
  const data = request.data;
  const { platform, language } = data;
  const comment = {
    cpp: '//',
    java: '//',
    py: '#',
  }[language];
  data.sourceCode = `${comment} UUID: ${randomUUID()}\n` + data.sourceCode;

  if (platform !== 'codeforces') {
    throw new HttpsError(
      'unimplemented',
      `platform '${platform}' is unimplemented`
    );
  }

  return submitProblemSolutionCodeforces(data);
});

const CODEFORCES_PROBLEM_REGEX = /^(\d+)([A-Z].*)$/;

async function submitProblemSolutionCodeforces({
  problemID,
  sourceCode,
  language,
}: ProblemSolution): Promise<ClientSubmissionData> {
  const csrf_token = getEnv('CF_CSRF_TOKEN');
  const cookie = getEnv('CF_COOKIE');
  const username = getEnv('CF_BOT_USERNAME');

  const matches = problemID.match(CODEFORCES_PROBLEM_REGEX);
  if (!matches) {
    throw new HttpsError(
      'invalid-argument',
      `'${problemID}' is not a valid Codeforces problem ID`
    );
  }
  const contestId = matches[1];
  const submittedProblemIndex = matches[2];

  const response = await fetch(
    'https://codeforces.com/problemset/submit?' +
      new URLSearchParams({ csrf_token }).toString(),
    {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: cookie,
        Referer: 'https://codeforces.com/problemset/submit',
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      },
      body: new URLSearchParams({
        action: 'submitSolutionFormSubmitted',
        contestId,
        submittedProblemIndex,
        source: sourceCode,
        programTypeId: {
          cpp: '54', // GNU G++17 7.3.0
          py: '70', // PyPy 3.9.10 (7.3.9, 64bit)
          java: '87', // Java 21 64bit
        }[language],
        tabSize: '4',
        csrf_token,
        ftaa: '',
        bfaa: '',
        sourceFile: '',
        _tta: '195',
      }),
      method: 'POST',
    }
  );
  if (response.status !== 200) {
    throw new Error('submission failed');
  }

  const text = await response.text();
  if (text.includes('You have submitted exactly the same code before')) {
    throw new HttpsError(
      'already-exists',
      `You have submitted exactly the same code before`
    );
  }
  const document = cheerio.load(text);
  const id = document('[data-submission-id]').attr('data-submission-id');
  if (!id) {
    throw new Error('cannot find submission id');
  }

  return {
    id,
    username,
    platform: 'codeforces',
  };
}

function getEnv(name: string): string {
  const r = process.env[name];
  if (!r) throw new Error(`environment variable '${name}' is unset`);
  return r;
}

export const cfAPIKey = defineString('CF_API_KEY');
export const cfAPISecret = defineString('CF_API_SECRET');
export const atCoderCookie = defineString('ATCODER_COOKIE');
export const csesCookie = defineString('CSES_COOKIE');

export class IncorrectDataError extends Error {}

admin.initializeApp();
const db = admin.database();

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

const updateStatusData = async (
  id: string,
  statusData: Partial<StatusData>
) => {
  const updates: { [key: string]: Partial<StatusData> | null } = {};
  updates[`submissions/${id}/statusData`] = statusData;
  if (['error', 'resolved'].includes(statusData.statusCode!)) {
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
              ? 'Error: incorrect data'
              : 'Error: unknown error',
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
        const username = fileData.submission.username;

        submissionData.push({
          fileID: fileID,
          platform: platform,
          username: username,
          sessionCookie: accountData[platform]?.sessionCookie?.value() ?? null,
          problemID: problemID,
          submissionID: submissionID,
          creationTime: creationTime,
        });
      } catch (error) {
        await updateStatusData(fileID, {
          statusCode: 'error',
          statusText: 'status-done',
          message: 'Error: incorrect data',
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
  pendingByPlatform['cses']?.forEach(obj => {
    promises.push(updateResultNonCF(obj));
  });
  pendingByPlatform['atcoder']?.forEach(obj => {
    promises.push(updateResultNonCF(obj));
  });
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
    const pending = (await db.ref('submissions/pending').get()).val();
    await updateResults(pending);
  } catch (error) {
    logger.log(error);
  } finally {
    await db.ref('submissions/lock').set(null);
  }
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
