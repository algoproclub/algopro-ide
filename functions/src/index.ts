import { onCall, HttpsError } from 'firebase-functions/v2/https';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { Sample } from '../../src/types/judge';
import { ElementType } from 'domelementtype';
import * as domhandler from 'domhandler';
import {
  Platform,
  PlatformProblem,
  ProblemData,
  ProblemSolution,
  SubmissionData,
} from '../../src/types/problem';

// FIXME: We might need to escape HTML entities (?)
function htmlToPlaintext(node: domhandler.ChildNode): string {
  if (node instanceof domhandler.Text) {
    return node.data;
  }
  if (node instanceof domhandler.Element) {
    const lineBreak =
      node.type === ElementType.Tag &&
      (node.tagName === 'br' ||
        (node.tagName === 'div' &&
          node.attribs.class.includes('test-example-line')));
    return (
      node.children.map(htmlToPlaintext).join('') + (lineBreak ? '\n' : '')
    );
  }
  return '';
}

const CODEFORCES_PROBLEM_REGEX = /^(\d+)([A-Z].*)$/;
const CODEFORCES_TITLE_REGEX = /\w+\. (.*)/;

const ATCODER_PROBLEM_REGEX = /(\w+)_(\w+)/;

export const fetchProblemData = onCall<
  PlatformProblem,
  Promise<ProblemData | null>
>(async request => {
  const { platform, problemID } = request.data;
  if (typeof platform !== 'string' || typeof problemID !== 'string') {
    return null;
  }

  switch (platform.toUpperCase()) {
    case 'CF':
      return fetchProblemDataCodeforces(problemID);
    case 'ATCODER':
      return fetchProblemDataAtCoder(problemID);
    default:
      throw new HttpsError(
        'unimplemented',
        `platform '${platform}' is unimplemented`
      );
  }
});

async function fetchProblemDataCodeforces(
  problemID: string
): Promise<ProblemData | null> {
  const matches = problemID.match(CODEFORCES_PROBLEM_REGEX);
  if (!matches) {
    return null;
  }

  const url = `https://codeforces.com/problemset/problem/${matches[1]}/${matches[2]}`;
  const problemPage = await fetch(url);
  if (!problemPage) {
    return null;
  }

  const document = cheerio.load(await problemPage.text());

  const samples: Sample[] = [];
  const inputsAndOutputs = Array.from(document('.sample-test pre')).map(
    htmlToPlaintext
  );
  for (let i = 0; i < inputsAndOutputs.length; i += 2) {
    samples.push({
      input: inputsAndOutputs[i],
      output: inputsAndOutputs[i + 1],
    });
  }

  return {
    id: problemID,
    submittable: true,
    platform: Platform.CF,
    url,
    title: document('.header > .title')
      .text()
      .match(CODEFORCES_TITLE_REGEX)![1],
    statement: document('.problem-statement > :not(.sample-tests, .header)')
      .map((_, el) => document(el).html())
      .toArray()
      .join('\n'),
    input: 'asdasdasd',
    output: 'XXXXXXx',
    source: `Codeforces ${problemID}`,
    samples,
  };
}

async function fetchProblemDataAtCoder(
  problemID: string
): Promise<ProblemData | null> {
  const matches = problemID.match(ATCODER_PROBLEM_REGEX);
  if (!matches) {
    return null;
  }

  const url = `https://atcoder.jp/contests/${matches[1]}/tasks/${problemID}`;
  const problemPage = await fetch(url);
  if (!problemPage) {
    return null;
  }

  const document = cheerio.load(await problemPage.text());

  const samples: Sample[] = [];
  const inputsAndOutputs = document('#task-statement .lang-en > div')
    .filter((_, el) => document('h3', el).text().startsWith('Sample'))
    .map((_, el) => document('pre', el).text())
    .get();

  for (let i = 0; i < inputsAndOutputs.length; i += 2)
    samples.push({
      input: inputsAndOutputs[i],
      output: inputsAndOutputs[i + 1],
    });

  const title = document('span.h2')
    .first()
    .contents()
    .filter((_, el) => el.type === 'text')
    .text()
    .trim();

  const statement = document('#task-statement .lang-en > div')
    .filter((_, el) => !document('h3', el).text().startsWith('Sample'))
    .map((_, el) => document(el).html())
    .toArray()
    .join('\n');

  return {
    id: problemID,
    submittable: true,
    platform: Platform.ATCODER,
    url,
    title,
    statement,
    input: 'asdasdasd',
    output: 'XXXXXXx',
    source: `AtCoder ${problemID}`,
    samples,
  };
}

export const submitProblemSolution = onCall<
  ProblemSolution,
  Promise<SubmissionData>
>(async request => {
  const { platform } = request.data;

  if (platform !== 'CF') {
    throw new HttpsError(
      'unimplemented',
      `platform '${platform}' is unimplemented`
    );
  }

  return submitProblemSolutionCodeforces(request.data);
});

async function submitProblemSolutionCodeforces({
  problemID,
  sourceCode,
  language,
}: ProblemSolution): Promise<SubmissionData> {
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
    platform: Platform.CF,
  };
}

function getEnv(name: string): string {
  const r = process.env[name];
  if (!r) throw new Error(`environment variable '${name}' is unset`);
  return r;
}
