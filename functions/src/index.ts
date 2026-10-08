import { defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import {
  Platform,
  ProblemData,
  ProblemSolution,
  StatusData,
  SubmissionData as ClientSubmissionData,
} from '../../src/types/problem';
import {
  AtCoderResultFetcher,
  CFResultFetcher,
  CSESResultFetcher,
  getCFRequestURL,
  NJudgeResultFetcher,
  YosupoResultFetcher,
  OjuzResultFetcher,
  PlanetsSubmission,
  planetsSubmissionToStatusData,
  ResultFetcher,
  SPOJResultFetcher,
} from './getResult';
import {
  AccountData,
  PendingSubmission,
  PendingSubmissions,
  SubmissionData,
  TournamentResult,
} from './types';
import {
  onValueCreated,
  onValueDeleted,
  onValueUpdated,
} from 'firebase-functions/v2/database';
import {
  onDocumentUpdated,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { randomUUID } from 'crypto';
import {
  AtCoderSubmitter,
  CSESSubmitter,
  NjudgeSubmitter,
  OjuzSubmitter,
  SPOJSubmitter,
  YosupoSubmitter,
  Submitter,
} from './submit';
import { JSDOM } from 'jsdom';
import { CompactEncrypt } from 'jose';

require('dotenv').config({ path: '.env.local' });

export const cfAPIKey = defineString('CF_API_KEY');
export const deeplAPIKey = defineString('DEEPL_API_KEY');
export const openaiAPIKey = defineString('OPENAI_API_KEY');
export const cfAPISecret = defineString('CF_API_SECRET');

export const loginBotUrl = defineString('LOGIN_BOT_URL');

const PENDING_TIME_LIMIT_MS = 300000;
const INCORRECT_DATA_RETRY_LIMIT_MS = 20000;
const STATUS_UPDATE_TIMEOUT_SECONDS = 60;
const STATUS_UPDATE_LEASE_MS = 90000;

type StatusUpdateLease = {
  owner: string;
  expiresAt: number;
};

const isStatusUpdateLease = (value: unknown): value is StatusUpdateLease => {
  if (!value || typeof value !== 'object') return false;
  const lease = value as Partial<StatusUpdateLease>;
  return typeof lease.owner === 'string' && typeof lease.expiresAt === 'number';
};

export const submitproblemsolution = onCall<
  ProblemSolution,
  Promise<ClientSubmissionData>
>(
  { region: 'europe-west1', cpu: 1, concurrency: 10, maxInstances: 5 },
  async request => {
    const problemSolution = request.data;
    const userID = request.auth?.uid;
    if (!(await canRegisterSubmissionForFile(problemSolution.fileID, userID))) {
      throw new HttpsError(
        'permission-denied',
        'You do not have permission to submit from this file.'
      );
    }

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
        // Codeforces does not return the submission ID, so CFSubmitter looks
        // for the UUID in the account's newest submission. With concurrent
        // requests on the same account, a newer submission hides the older one
        // and its lookup times out. Before re-enabling automatic submission,
        // make CFSubmitter check the UUID in the account's recent submissions
        // of the same problem instead of only the newest one.
        throw new HttpsError(
          'failed-precondition',
          'Automatic submission is not supported for Codeforces.'
        );
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
        return submitToPlanets(problemSolution, uuid, userID!);
      case 'ojuz':
        submitter = new OjuzSubmitter();
        break;
      case 'njudge':
        submitter = new NjudgeSubmitter();
        break;
      case 'yosupo':
        submitter = new YosupoSubmitter();
        break;
      default:
        throw new HttpsError(
          'unimplemented',
          `platform '${platform}' is unimplemented`
        );
    }
    await submitter.login(db);
    const submissionData = await submitter.submit(problemSolution, uuid);
    await registerSubmission(
      problemSolution.fileID,
      submissionData.id,
      submissionData.username
    );
    return submissionData;
  }
);

export const onplanetsubmissionupdated = onDocumentUpdated(
  {
    document: 'submissions/{submissionID}',
    database: 'planets',
    region: 'europe-west1',
    retry: false,
  },
  async event => {
    const change = event.data;
    if (!change) return;

    const after = change.after.data() as PlanetsSubmission;
    if (!after.ide) return;
    if (after.verdict === 'Starting evaluation') return;

    const submissionTime = after.timestamp.toMillis();
    const currentSubmissionTime = (
      await db.ref(`submissions/${after.ide.file_id}/submissionTime`).get()
    ).val();
    // A newer submission has been made for this file.
    if (currentSubmissionTime !== submissionTime) return;

    await updateStatusData(
      after.ide.file_id,
      {
        submissionID: event.params.submissionID,
        platform: 'planets',
        problemID: after.problem_id,
        submissionTime,
        tournamentID: after.ide.tournament_id,
      },
      planetsSubmissionToStatusData(after),
      // Updates can arrive out of order.
      { keepFinalStatus: true }
    );
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
  const { text, lang } = request.data;

  const document = new JSDOM(text).window.document;
  for (const el of document.getElementsByTagName('pre'))
    el.setAttribute('translate', 'no');

  const resp = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${deeplAPIKey.value()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [document.body.innerHTML],
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

export const generateToken = onCall<
  {
    schoolID: string;
    expTime: number;
  },
  Promise<string | null>
>({ region: 'europe-west1' }, async request => {
  const { schoolID, expTime } = request.data;
  if (
    !request.auth?.token?.admin &&
    !request.auth?.token?.teacher?.includes(schoolID)
  ) {
    return null;
  }
  const times = [
    3 * 24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000,
    14 * 24 * 60 * 60 * 1000,
  ];
  if (!times.includes(expTime)) {
    return null;
  }
  const payload = {
    school_id: schoolID,
    exp: Date.now() + expTime,
  };
  const secret =
    process.env.ONBOARDING_SECRET || 'abcdabcdabcdabcdabcdabcdabcdabcd';
  const secretKey = new TextEncoder().encode(secret);

  return await new CompactEncrypt(
    new TextEncoder().encode(JSON.stringify(payload))
  )
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .encrypt(secretKey);
});

export const translateOpenAI = onCall<
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

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiAPIKey.value()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.95,
      top_p: 0.95,
      presence_penalty: 0.05,
      messages: [
        {
          role: 'system',
          content: `You are a professional translator specializing in competitive programming problems.
                You will receive an HTML code snippet containing a problem statement, which may include LaTeX formulas.
                Your task:
                    Translate the problem precisely and naturally while preserving its meaning, structure, and formatting.
                    Ensure that the translation follows proper mathematical terminology and competitive programming conventions.
                    Do not rephrase unnecessarily. Maintain the original sentence structure where possible unless required for fluency.
                    Use clear, formal, and concise language suitable for competitive programming statements.
                    Keep all mathematical notation and LaTeX syntax unchanged.
                    Follow the standard way problems are written in the target language (e.g., Hungarian).
                Specific Translation Rules:
                    Use precise terminology: Keep technical terms correct and natural in the target language.
                    Ensure smooth, natural phrasing: Avoid direct, awkward word-for-word translations.
                    Use a neutral, formal style: Avoid conversational tone and overly direct instructions.
                    Preserve list formatting and structure: Ensure that input/output constraints and explanations stay intact.
                    Clarify conditions explicitly when needed: If something is unclear in the original, use natural wording that makes it precise.
                Translate the problem into the following language: [${lang}]`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
    }),
  });
  let translation: string | null = null;
  try {
    const json = await resp.json();
    translation = json['choices'][0].message.content ?? null;
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

const app = initializeApp(
  process.env.FUNCTIONS_EMULATOR
    ? {
        projectId: 'algopro-app',
        databaseURL: 'http://firebase:9000?ns=algopro-app-default-rtdb',
      }
    : undefined
);
const db = getDatabase(app);
const firestore = getFirestore(app);
const planetsFirestore = getFirestore(app, 'planets');

const submitToPlanets = async (
  { fileID, problemID, sourceCode, language }: ProblemSolution,
  submissionID: string,
  userID: string
): Promise<ClientSubmissionData> => {
  const submission = await registerSubmission(fileID, submissionID, null, {
    polled: false,
  });
  try {
    const problem = await planetsFirestore.doc(`problems/${problemID}`).get();
    if (!problem.exists) {
      throw new Error(`no such Planets problem: ${problemID}`);
    }
    await planetsFirestore.doc(`submissions/${submissionID}`).create({
      user_id: userID,
      problem_id: problemID,
      topic_id: problem.data()!.topicID,
      timestamp: new Date(submission.submissionTime),
      language: { cpp: 'cpp17', java: 'java', py: 'python3' }[language],
      solution: sourceCode,
      verdict: 'Starting evaluation',
      state: 'queued',
      ide: { file_id: fileID, tournament_id: submission.tournamentID ?? null },
    });
  } catch (error) {
    logger.error('Failed to create Planets submission', error);
    await updateStatusData(
      fileID,
      submission,
      {
        statusCode: 'error',
        statusText: 'status-done',
        message: Errors.UNKNOWN_ERROR,
      },
      { polled: false }
    );
    throw new HttpsError('internal', 'Failed to create the submission.');
  }
  return { id: submissionID, username: null, platform: 'planets' };
};

export const updateProblemLibraryRevision = onDocumentWritten(
  {
    document: 'problemsets/{platform}/problems/{problem}',
    region: 'europe-west1',
  },
  async event => {
    const metadata = (data: Record<string, unknown> | undefined) =>
      JSON.stringify({
        title: data?.title ?? null,
        url: data?.url ?? null,
        tags: data?.tags ?? null,
      });
    if (
      metadata(event.data?.before.data()) === metadata(event.data?.after.data())
    ) {
      return;
    }

    await firestore.doc('metadata/problemLibrary').set(
      {
        revision: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
);

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
  ojuz: {
    sessionCookie: async () =>
      (await db.ref('credentials/ojuz/0/cookie').get()).val(),
  },
  njudge: {},
  yosupo: {},
};

const updateTournamentResult = async (
  tournamentID: string,
  fileID: string,
  result: Partial<TournamentResult>
) => {
  const ownerID = await getFileOwner(fileID);
  if (!ownerID) {
    return;
  }
  const tournamentRef = db.ref(
    `tournaments/${tournamentID}/participants/${ownerID}`
  );
  const prevResult = (await tournamentRef.get()).val();
  if (prevResult.message === 'correct answer') {
    return;
  }
  await tournamentRef.update(result);
};

const getFileOwner = async (fileID: string): Promise<string | undefined> => {
  type UserList = { [key: string]: { permission: string } };

  const fileData = (
    await db.ref(`files/${fileID}/users`).get()
  ).val() as UserList;

  return Object.entries(fileData).find(
    ([, data]) => data.permission === 'OWNER'
  )?.[0];
};

const isFinalStatus = (statusData: Partial<StatusData>) =>
  statusData.statusCode === 'error' || statusData.statusCode === 'resolved';

type StatusHistoryEntry = Partial<StatusData> & { submissionTime: number };

// The same submission can be reported final more than once, e.g. by a status
// update round resuming after its lease was taken over, or by a result arriving
// after a timeout, so keep only its latest final status.
const withFinalStatus = (
  history: StatusHistoryEntry[] | null,
  entry: StatusHistoryEntry
) =>
  history?.at(-1)?.submissionTime === entry.submissionTime
    ? [...history.slice(0, -1), entry]
    : [...(history ?? []), entry];

const updateStatusData = async (
  id: string,
  submission: PendingSubmission,
  statusData: Partial<StatusData>,
  { keepFinalStatus = false, polled = true } = {}
) => {
  if (isFinalStatus(statusData)) {
    await db
      .ref(`submissions/${id}/statusDataHistory`)
      .transaction((history: StatusHistoryEntry[] | null) =>
        withFinalStatus(history, {
          ...statusData,
          submissionTime: submission.submissionTime,
        })
      );

    const queueEntry = polled
      ? `submissionQueue/pending/${id}`
      : `submissionQueue/unpolled/${id}/${submission.submissionID}`;
    const updates: { [key: string]: Partial<StatusData> | boolean | null } = {
      [`submissions/${id}/statusData`]: statusData,
      [queueEntry]: null,
    };
    if (statusData.message === 'correct answer') {
      updates[`files/${id}/solvedStatus/solved`] = true;
      try {
        const ownerID = await getFileOwner(id);
        if (ownerID) {
          updates[
            `users/${ownerID}/platform-${submission.platform}/solved/${submission.problemID}`
          ] = true;
        }
      } catch (e) {
        console.error('Failed to denormalize solved status for file', id, e);
      }
    }
    await db.ref().update(updates);
  } else if (keepFinalStatus) {
    const { committed } = await db
      .ref(`submissions/${id}/statusData`)
      .transaction((current: Partial<StatusData> | null) =>
        current && isFinalStatus(current) ? undefined : statusData
      );
    if (!committed) return;
  } else {
    await db.ref(`submissions/${id}/statusData`).set(statusData);
  }

  if (submission.tournamentID) {
    await updateTournamentResult(submission.tournamentID, id, {
      statusCode: statusData.statusCode,
      message: statusData.message,
    });
  }
};

const getAndUpdate = async (fetcher: ResultFetcher, fileID: string) => {
  try {
    const data = await fetcher.getResults();
    await updateStatusData(fileID, fetcher.submissionData, data);
  } catch (error) {
    let message = Errors.UNKNOWN_ERROR;
    if (error instanceof IncorrectDataError) {
      if (
        fetcher.submissionData.submissionTime >
        Date.now() - INCORRECT_DATA_RETRY_LIMIT_MS
      ) {
        return;
      }
      message = Errors.NO_SUCH_SUBMISSION;
    }
    logger.log(error);
    await updateStatusData(fileID, fetcher.submissionData, {
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
  } else if (submissionData.platform === 'ojuz') {
    fetcher = new OjuzResultFetcher(submissionData);
  } else if (submissionData.platform === 'njudge') {
    fetcher = new NJudgeResultFetcher(submissionData);
  } else if (submissionData.platform === 'yosupo') {
    fetcher = new YosupoResultFetcher(submissionData);
  } else {
    throw new Error(`invalid platform name (${submissionData.platform})`);
  }
  await getAndUpdate(fetcher, submissionData.fileID);
};

const getContestId = (problemID: string): string => {
  const stripped = problemID.startsWith('gym') ? problemID.slice(3) : problemID;
  return stripped.match(/^(\d+)/)?.[1] ?? '';
};

const updateResultsCF = async (
  submissionDataList: SubmissionData[] | undefined
) => {
  if (!submissionDataList || submissionDataList.length === 0) {
    return;
  }
  const sorted = submissionDataList.sort(
    (a, b) => a.submissionTime - b.submissionTime
  );
  const first = sorted[0];
  const contestId = getContestId(first.problemID);
  const username = first.username;
  submissionDataList = submissionDataList.filter(
    s => getContestId(s.problemID) === contestId && s.username === username
  );

  const url = getCFRequestURL('contest.status', {
    contestId,
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
        updateStatusData(submissionData.fileID, submissionData, {
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
    const resultJSON = (await resp.json())['result'];
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

const updateResults = async (pending: PendingSubmissions) => {
  const sessionCookies: { [platform: string]: Promise<string | null> } = {};
  const pendingData = await Promise.all(
    Object.entries(pending).map(
      async ([fileID, submission]): Promise<SubmissionData> => {
        const { platform } = submission;
        sessionCookies[platform] ??= Promise.resolve(
          accountData[platform].sessionCookie?.() ?? null
        );
        return {
          ...submission,
          fileID,
          sessionCookie: await sessionCookies[platform],
        };
      }
    )
  );
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
  for (const platform of [
    'cses',
    'atcoder',
    'spoj',
    'ojuz',
    'njudge',
    'yosupo',
  ]) {
    pendingByPlatform[platform]?.forEach(obj => {
      promises.push(updateResultNonCF(obj));
    });
  }
  promises.push(updateResultsCF(pendingByPlatform['codeforces']));
  await Promise.all(promises);
};

const canRegisterSubmissionForFile = async (
  fileID: string,
  userID: string | undefined
): Promise<boolean> => {
  if (!userID) return false;

  const userSnapshot = await db.ref(`files/${fileID}/users/${userID}`).get();
  if (!userSnapshot.exists()) return false;

  const permission =
    userSnapshot.val()?.permission ??
    (await db.ref(`files/${fileID}/settings/defaultPermission`).get()).val();

  return ['OWNER', 'READ_WRITE'].includes(permission);
};

const registerSubmission = async (
  fileID: string,
  submissionID: string,
  username: string | null,
  { polled = true } = {}
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
  const submissionTime = Date.now();
  const [problem, tournamentID] = await Promise.all([
    db
      .ref(`files/${fileID}/problem`)
      .get()
      .then(snapshot => snapshot.val() as ProblemData),
    db
      .ref(`files/${fileID}/tournamentID`)
      .get()
      .then(snapshot => snapshot.val() as string | null),
  ]);
  const submission: PendingSubmission = {
    submissionID,
    platform: problem.platform,
    problemID: problem.id,
    submissionTime,
    username,
    tournamentID,
  };
  const queueEntry = polled
    ? `submissionQueue/pending/${fileID}`
    : `submissionQueue/unpolled/${fileID}/${submissionID}`;
  await db.ref().update({
    [`submissions/${fileID}/statusData`]: defaultStatusData,
    [`submissions/${fileID}/submissionTime`]: submissionTime,
    [queueEntry]: submission,
  });

  if (tournamentID) {
    void updateTournamentResult(tournamentID, fileID, {
      message: defaultStatusData.message,
      statusCode: defaultStatusData.statusCode,
      submissionTime: submissionTime,
    });
  }
  return submission;
};

exports.registersubmission = onCall(
  { region: 'europe-west1' },
  async request => {
    const fileID = request.data.fileID;
    const userID = request.auth?.uid;
    if (!(await canRegisterSubmissionForFile(fileID, userID))) {
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

const expireUnpolledSubmission = async (
  fileID: string,
  submission: PendingSubmission
) => {
  const statusData: Partial<StatusData> = {
    statusCode: 'error',
    statusText: 'status-done',
    message: Errors.PENDING_TIMEOUT,
  };
  const { committed, snapshot } = await db
    .ref(`submissions/${fileID}`)
    .transaction(
      (
        current: {
          submissionTime?: number;
          statusData?: Partial<StatusData>;
          statusDataHistory?: StatusHistoryEntry[];
        } | null
      ) => {
        if (current === null) return null;
        if (
          current.submissionTime !== submission.submissionTime ||
          (current.statusData && isFinalStatus(current.statusData))
        ) {
          return undefined;
        }
        return {
          ...current,
          statusData,
          statusDataHistory: withFinalStatus(
            current.statusDataHistory ?? null,
            { ...statusData, submissionTime: submission.submissionTime }
          ),
        };
      }
    );
  await db
    .ref(`submissionQueue/unpolled/${fileID}/${submission.submissionID}`)
    .remove();
  if (committed && snapshot.exists() && submission.tournamentID) {
    await updateTournamentResult(submission.tournamentID, fileID, {
      statusCode: statusData.statusCode,
      message: statusData.message,
    });
  }
};

const expireUnpolledSubmissions = async () => {
  const unpolled = (await db.ref('submissionQueue/unpolled').get()).val() as {
    [fileID: string]: { [submissionID: string]: PendingSubmission };
  } | null;
  const cutoff = Date.now() - PENDING_TIME_LIMIT_MS;
  await Promise.all(
    Object.entries(unpolled ?? {}).flatMap(([fileID, submissions]) =>
      Object.values(submissions)
        .filter(submission => submission.submissionTime <= cutoff)
        .map(submission => expireUnpolledSubmission(fileID, submission))
    )
  );
};

const updateStatus = async () => {
  const hasPending = (
    await db.ref('submissionQueue/pending').limitToFirst(1).get()
  ).exists();
  if (!hasPending) {
    return;
  }
  const lockRef = db.ref('submissionQueue/lock');
  const owner = randomUUID();
  const now = Date.now();
  const lease: StatusUpdateLease = {
    owner,
    expiresAt: now + STATUS_UPDATE_LEASE_MS,
  };
  const lockTransaction = await lockRef.transaction((lock: unknown) => {
    // Anything but an unexpired lease is stale.
    if (isStatusUpdateLease(lock) && lock.expiresAt > now) return undefined;
    return lease;
  });
  // Only our own lease is ever written, so committing means we hold it.
  if (!lockTransaction.committed) {
    return;
  }
  try {
    await new Promise(r => setTimeout(r, 2000));
    const pending = (
      await db.ref('submissionQueue/pending').get()
    ).val() as PendingSubmissions | null;
    if (!pending) return;
    const cutoff = Date.now() - PENDING_TIME_LIMIT_MS;

    const filtered: PendingSubmissions = {};
    const promises: Promise<void>[] = [];

    Object.entries(pending).forEach(([fileID, submission]) => {
      if (submission.submissionTime <= cutoff) {
        promises.push(
          updateStatusData(fileID, submission, {
            statusCode: 'error',
            statusText: 'status-done',
            message: Errors.PENDING_TIMEOUT,
          })
        );
      } else {
        filtered[fileID] = submission;
      }
    });
    await Promise.all(promises);
    await updateResults(filtered);
  } catch (error) {
    logger.log(error);
  } finally {
    await lockRef.transaction((lock: unknown) => {
      if (lock === null) return null;
      if (isStatusUpdateLease(lock) && lock.owner === owner) return null;
      return undefined;
    });
  }
};

const region = process.env.FUNCTIONS_EMULATOR ? 'us-central1' : 'europe-west1';

exports.onlockdeleted = onValueDeleted(
  {
    ref: 'submissionQueue/lock',
    region,
    timeoutSeconds: STATUS_UPDATE_TIMEOUT_SECONDS,
  },
  updateStatus
);
exports.onpendingcreated = onValueCreated(
  {
    ref: 'submissionQueue/pending/{fileID}',
    region,
    timeoutSeconds: STATUS_UPDATE_TIMEOUT_SECONDS,
  },
  updateStatus
);
exports.onpendingupdated = onValueUpdated(
  {
    ref: 'submissionQueue/pending/{fileID}',
    region,
    timeoutSeconds: STATUS_UPDATE_TIMEOUT_SECONDS,
  },
  updateStatus
);
// Restarts status updates if a run died while holding the lease, and times out
// submissions whose results should have been pushed by now.
exports.statusupdatewakeup = onSchedule(
  {
    schedule: 'every 5 minutes',
    region,
    timeoutSeconds: STATUS_UPDATE_TIMEOUT_SECONDS,
  },
  async () => {
    await Promise.all([updateStatus(), expireUnpolledSubmissions()]);
  }
);
