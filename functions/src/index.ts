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
import FormData = require('form-data');

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

  switch (platform) {
    case 'codeforces':
      return submitProblemSolutionCodeforces(data);
    case 'atcoder':
      return submitProblemSolutionAtCoder(data);
    case 'cses':
      return submitProblemSolutionCSES(data);
    default:
      throw new HttpsError(
        'unimplemented',
        `platform '${platform}' is unimplemented`
      );
  }
});

const CODEFORCES_PROBLEM_REGEX = /^(\d+)([A-Z].*)$/;
const ATCODER_PROBLEM_REGEX = /(\w+)_(\w+)/;

async function submitProblemSolutionCodeforces({
  problemID,
  sourceCode,
  language,
}: ProblemSolution): Promise<ClientSubmissionData> {
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
      new URLSearchParams({ csrf_token: cfCsrfToken.value() }).toString(),
    {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: cfCookie.value(),
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
        csrf_token: cfCsrfToken.value(),
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
    username: cfUsername.value(),
    platform: 'codeforces',
  };
}

async function submitProblemSolutionAtCoder({
  problemID,
  sourceCode,
  language,
}: ProblemSolution): Promise<ClientSubmissionData> {
  const matches = problemID.match(ATCODER_PROBLEM_REGEX);
  if (!matches) {
    throw new HttpsError(
      'invalid-argument',
      `'${problemID}' is not a valid AtCoder problem ID`
    );
  }
  const contestId = matches[1];

  const response = await fetch(
    `https://atcoder.jp/contests/${contestId}/submit`,
    {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: atCoderCookie.value(),
      },
      body: new URLSearchParams({
        'data.TaskScreenName': problemID,
        sourceCode,
        'data.LanguageId': {
          cpp: '5053', // C++ 17 (gcc 12.2)
          py: '5078', // Python (PyPy 3.10-v7.3.12)
          java: '5005', // Java (OpenJDK 17)
        }[language],
        csrf_token: atCoderCsrfToken.value(),
      }),
      method: 'POST',
    }
  );
  if (response.status !== 200) {
    throw new Error('submission failed');
  }

  const text = await response.text();
  const $ = cheerio.load(text);
  const id = $('tbody > tr > td:last > a').attr('href')?.split('/').pop();
  if (!id) {
    throw new Error('cannot find submission id');
  }

  return {
    id,
    username: null,
    platform: 'atcoder',
  };
}

async function submitProblemSolutionCSES({
  problemID,
  sourceCode,
  language,
}: ProblemSolution): Promise<ClientSubmissionData> {
  const formData = new FormData();
  formData.append('csrf_token', csesCsrfToken.value());
  formData.append('task', problemID);
  formData.append('file', sourceCode, { filename: 'f' });
  formData.append(
    'lang',
    { cpp: 'C++', py: 'Python3', java: 'Java' }[language]
  );
  if (language != 'java') {
    formData.append('option', { cpp: 'C++17', py: 'PyPy3' }[language]);
  }
  formData.append('type', 'course');
  formData.append('target', 'problemset');

  const response = await fetch(`https://cses.fi/course/send.php`, {
    headers: {
      cookie: csesCookie.value(),
    },
    body: formData,
    method: 'POST',
  });
  if (response.status !== 200) {
    throw new Error('submission failed');
  }

  const text = await response.text();
  const id = text.match(/\/ajax\/get_status\.php\?entry=([0-9]+)/)?.[1];
  if (!id) {
    throw new Error('cannot find submission id');
  }

  return {
    id,
    username: null,
    platform: 'cses',
  };
}

export const cfAPIKey = defineString('CF_API_KEY');
export const cfAPISecret = defineString('CF_API_SECRET');
export const cfCsrfToken = defineString('CF_CSRF_TOKEN');
export const cfCookie = defineString('CF_COOKIE');
export const cfUsername = defineString('CF_BOT_USERNAME');

export const atCoderCookie = defineString('ATCODER_COOKIE');
export const atCoderCsrfToken = defineString('ATCODER_CSRF_TOKEN');

export const csesCookie = defineString('CSES_COOKIE');
export const csesCsrfToken = defineString('CSES_CSRF_TOKEN');

const PENDING_TIME_LIMIT_MS = 300000;
const INCORRECT_DATA_RETRY_LIMIT_MS = 20000;

enum Errors {
  NO_SUCH_SUBMISSION = 'No such submission exists for the given problem. Please check if the entered submission ID is correct.',
  UNKNOWN_ERROR = 'Could not retrieve the results due to an unknown error',
  PENDING_TIMEOUT = 'Could not retreive the submission results in time. Please try again later.',
}

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
