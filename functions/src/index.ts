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

export const fetchProblemData = onCall<
  PlatformProblem,
  Promise<ProblemData | null>
>(async request => {
  const platform = request.data.platform;
  const problemID = request.data.problemID;
  if (typeof platform !== 'string') {
    return null;
  }
  if (platform !== 'CF') {
    return null;
  }
  if (typeof problemID !== 'string') {
    return null;
  }

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

  const statement = document('.problem-statement > :not([class])');
  const inputSpec = document('.problem-statement > .input-specification');
  const outputSpec = document('.problem-statement > .output-specification');

  return {
    id: problemID,
    submittable: true,
    platform,
    url,
    title: document('.header > .title').text(),
    statement: [statement, inputSpec, outputSpec]
      .map(el => el.html())
      .join('\n'),
    input: 'asdasdasd',
    output: 'XXXXXXx',
    source: `Codeforces ${problemID}`,
    samples,
  };
});

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
