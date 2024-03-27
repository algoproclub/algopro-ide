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
  spojCookie,
} from './index';

const GETSUBMISSIONDATA_DELAY_MS = 1000;
const MAX_GETSUBMISSIONDATA_TRIES = 8;

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

    for (let i = 0; i < MAX_GETSUBMISSIONDATA_TRIES; ++i) {
      const newData = await this.getSubmissionData();
      if (newData.id !== oldId) {
        return newData;
      }
      await new Promise(r => setTimeout(r, GETSUBMISSIONDATA_DELAY_MS));
    }
    throw new TimeOutError(
      `fetching submission ID for ${this.problemSolution} timed out`
    );
  }
}

export class CFSubmitter extends Submitter {
  private accountIdx: number;
  constructor(readonly problemSolution: ProblemSolution) {
    super(problemSolution);
    this.accountIdx = 0;
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

    const accountCount = cfCookie.value().split(';').length;
    if (cfCsrfToken.value().split(';').length != accountCount) {
      throw new Error('CF cookie and csrf token count mismatch');
    }
    if (cfUsername.value().split(';').length != accountCount) {
      throw new Error('CF cookie and username count mismatch');
    }
    this.accountIdx = Math.floor(Math.random() * accountCount);
    const cookie = cfCookie.value().split(';')[this.accountIdx];
    const csrf_token = cfCsrfToken.value().split(';')[this.accountIdx];
    const username = cfUsername.value().split(';')[this.accountIdx];
    console.log(
      `using CF account #${this.accountIdx}, username: ${username}, cookie: ${cookie}, csrf_token: ${csrf_token}`
    );

    const response = await fetch(
      'https://codeforces.com/problemset/submit?' +
        new URLSearchParams({ csrf_token: csrf_token }).toString(),
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie,
          Referer: 'https://codeforces.com/problemset/submit',
          'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        body: new URLSearchParams({
          action: 'submitSolutionFormSubmitted',
          contestId,
          submittedProblemIndex,
          source: sourceCode,
          programTypeId: {
            cpp: '54', // GNU G++17
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
    const text = await response.text();
    if (response.status !== 200) {
      console.log(
        'submission response.status: ',
        response.status,
        response.statusText
      );
      console.log('submission response.text: ', text.replaceAll('\n', ''));
      throw new Error(
        'submission failed, user: ' + username + ', status: ' + response.status
      );
    }
    if (text.includes('You have submitted exactly the same code before')) {
      throw new HttpsError(
        'already-exists',
        `You have submitted exactly the same code before`
      );
    }
  }

  async getSubmissionData(): Promise<ClientSubmissionData> {
    const username = cfUsername.value().split(';')[this.accountIdx];
    const response = await fetch(
      `https://codeforces.com/submissions/${username}`
    );
    const document = cheerio.load(await response.text());
    const id = document('[data-submission-id]').attr('data-submission-id');
    if (!id) {
      throw new IDNotFoundError('cannot find submission id');
    }
    return {
      id,
      username,
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

    const accountCount = atCoderCookie.value().split(';').length;
    if (atCoderCsrfToken.value().split(';').length != accountCount) {
      throw new Error('AtCoder cookie and csrf token count mismatch');
    }
    const accountIdx = Math.floor(Math.random() * accountCount);
    const cookie = atCoderCookie.value().split(';')[accountIdx];
    const csrf_token = atCoderCsrfToken.value().split(';')[accountIdx];
    console.log(
      `using AtCoder account #${accountIdx}, cookie: ${cookie}, csrf_token: ${csrf_token}`
    );

    const response = await fetch(
      `https://atcoder.jp/contests/${contestId}/submit`,
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie,
        },
        body: new URLSearchParams({
          'data.TaskScreenName': problemID,
          sourceCode,
          'data.LanguageId': {
            cpp: '5001', // C++ 20 (gcc 12.2)
            py: '5078', // Python (PyPy 3.10-v7.3.12)
            java: '5005', // Java (OpenJDK 17)
          }[language],
          csrf_token,
        }),
        method: 'POST',
      }
    );
    const text = await response.text();
    if (response.status !== 200) {
      console.log(
        'submission response.status: ',
        response.status,
        response.statusText
      );
      console.log('submission response.text: ', text.replaceAll('\n', ''));
      throw new Error('submission failed, status: ' + response.status);
    }
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
      formData.append('option', { cpp: 'C++20', py: 'PyPy3' }[language]);
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
    const text = await response.text();
    if (response.status !== 200) {
      console.log(
        'submission response.status: ',
        response.status,
        response.statusText
      );
      console.log('submission response.text: ', text.replaceAll('\n', ''));
      throw new Error('submission failed, status: ' + response.status);
    }
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

export class SPOJSubmitter extends Submitter {
  private submissionID?: string;
  constructor(readonly problemSolution: ProblemSolution) {
    super(problemSolution);
  }

  async submit(): Promise<void> {
    const { problemID, sourceCode, language } = this.problemSolution;
    const formData = new FormData();
    formData.append('subm_file', sourceCode, {
      filename: '',
      contentType: 'application/octet-stream',
    });
    formData.append('file', sourceCode);
    formData.append(
      'lang',
      {
        cpp: '1', // C++ (gcc 8.3) (C++14)
        py: '109', // Python 3 (PyPy 3.6.1)
        java: '10', // Java (HotSpot 12)
      }[language]
    );
    formData.append('problemcode', problemID);
    formData.append('submit', 'Submit!');

    const response = await fetch(`https://www.spoj.com/submit/complete/`, {
      headers: {
        cookie: spojCookie.value(),
      },
      body: formData,
      method: 'POST',
    });
    const text = await response.text();
    const id = text.match(/\/status\/\?ns=([0-9]+)/)?.[1];
    if (response.status !== 200 || !id) {
      console.log(
        'submission response.status: ',
        response.status,
        response.statusText
      );
      console.log('submission response.text: ', text.replaceAll('\n', ''));
      throw new Error('submission failed, status: ' + response.status);
    }
    this.submissionID = id;
  }
  async getSubmissionData(): Promise<ClientSubmissionData> {
    return {
      id: this.submissionID ?? '',
      username: null,
      platform: 'spoj',
    };
  }
}
