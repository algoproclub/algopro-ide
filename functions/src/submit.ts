import { ProblemSolution } from '../../src/types/problem';
import { SubmissionData as ClientSubmissionData } from '../../src/types/problem';
import { HttpsError } from 'firebase-functions/v2/https';
import FormData = require('form-data');
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import {
  atCoderCookie,
  atCoderCsrfToken,
  cfCookie,
  cfCsrfToken,
  cfUsername,
  csesCookie,
  csesCsrfToken,
} from './index';

const RETRY_GETSUBMISSIONDATA_TIMEOUT_MS = 5000;

const CODEFORCES_PROBLEM_REGEX = /^(\d+)([A-Z].*)$/;
const ATCODER_PROBLEM_REGEX = /(\w+)_(\w+)/;

class TimeOutError extends Error {}
class IDNotFoundError extends Error {}

export abstract class Submitter {
  protected constructor(readonly problemSolution: ProblemSolution) {}

  abstract submit(): Promise<void>;
  abstract getSubmissionData(): Promise<ClientSubmissionData>;

  async submitAndGet(): Promise<ClientSubmissionData> {
    let oldId: string | null = null;

    try {
      const oldData = await this.getSubmissionData();
      oldId = oldData.id;
    } catch (error) {
      if (!(error instanceof IDNotFoundError)) {
        throw error;
      }
    }
    await this.submit();
    const startTime = Date.now();

    while (true) {
      const newData = await this.getSubmissionData();
      if (newData.id !== oldId) {
        return newData;
      }
      if (Date.now() - startTime > RETRY_GETSUBMISSIONDATA_TIMEOUT_MS) {
        throw new TimeOutError(
          `fetching submission ID for ${this.problemSolution} timed out`
        );
      }
    }
  }
}

export class CFSubmitter extends Submitter {
  constructor(readonly problemSolution: ProblemSolution) {
    super(problemSolution);
  }
  async submit() {
    const { problemID, sourceCode, language } = this.problemSolution;
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
  }

  async getSubmissionData(): Promise<ClientSubmissionData> {
    const response = await fetch(
      `https://codeforces.com/submissions/${cfUsername.value()}`
    );
    const document = cheerio.load(await response.text());
    const id = document('[data-submission-id]').attr('data-submission-id');
    if (!id) {
      throw new IDNotFoundError('cannot find submission id');
    }
    return {
      id,
      username: cfUsername.value(),
      platform: 'codeforces',
    };
  }
}

export class AtCoderSubmitter extends Submitter {
  private submissionID?: string;

  constructor(problemSolution: ProblemSolution) {
    super(problemSolution);
  }

  async submit() {
    const { problemID, sourceCode, language } = this.problemSolution;
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
    const id = text.match(/\/contests\/\w+\/submissions\/([0-9]+)/)?.[1];
    if (!id) {
      throw new IDNotFoundError('cannot find submission id');
    }
    this.submissionID = id;
  }
  async getSubmissionData(): Promise<ClientSubmissionData> {
    return {
      id: this.submissionID ?? '',
      username: null,
      platform: 'atcoder',
    };
  }
}

export class CSESSubmitter extends Submitter {
  private submissionID?: string;
  constructor(readonly problemSolution: ProblemSolution) {
    super(problemSolution);
  }

  async submit(): Promise<void> {
    const { problemID, sourceCode, language } = this.problemSolution;
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
      throw new IDNotFoundError('cannot find submission id');
    }
    this.submissionID = id;
  }
  async getSubmissionData(): Promise<ClientSubmissionData> {
    return {
      id: this.submissionID ?? '',
      username: null,
      platform: 'cses',
    };
  }
}
