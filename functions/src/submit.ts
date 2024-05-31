import { ProblemSolution } from '../../src/types/problem';
import { SubmissionData as ClientSubmissionData } from '../../src/types/problem';
import { HttpsError } from 'firebase-functions/v2/https';
import FormData = require('form-data');
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { loginBotUrl } from './index';
import { Database } from 'firebase-admin/database';

const GETSUBMISSIONDATA_DELAY_MS = 1000;
const MAX_GETSUBMISSIONDATA_TRIES = 8;

const CODEFORCES_PROBLEM_REGEX = /^(\d+)([A-Z].*)$/;
const ATCODER_PROBLEM_REGEX = /(\w+)_(\w+)/;

class TimeOutError extends Error {}
class IDNotFoundError extends Error {}

export abstract class Submitter {
  abstract submit(
    problemSolution: ProblemSolution,
    uuid: string
  ): Promise<ClientSubmissionData>;
  abstract platformName: string;
  abstract loginWith(account: object): Promise<boolean>;
  async login(db: Database): Promise<void> {
    const accountCount = await db
      .ref('credentials')
      .child(this.platformName)
      .once('value')
      .then(snapshot => snapshot.numChildren());
    const accountIdx = Math.floor(Math.random() * accountCount);
    console.log(`using account #${accountIdx} for ${this.platformName} login`);
    let account = await db
      .ref('credentials')
      .child(this.platformName)
      .child(accountIdx.toString())
      .once('value')
      .then(snapshot => snapshot.val());
    if (!account) {
      throw new Error('no account found for ' + this.platformName);
    }
    console.log(
      `trying to login to ${this.platformName} with account #${accountIdx}, ${account.username}`
    );
    if (await this.loginWith(account)) return;
    console.warn('login failed, trying to login with login bot');
    const response = await fetch(loginBotUrl.value() + '/login', {
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...account, platform: this.platformName }),
      method: 'POST',
    });
    if (response.status !== 200) {
      throw new Error('login failed, bot response: ' + (await response.text()));
    }
    account = { ...account, ...(await response.json()) };
    if (!(await this.loginWith(account))) {
      throw new Error('login failed');
    }
    await db
      .ref('credentials')
      .child(this.platformName)
      .child(accountIdx.toString())
      .set(account);
  }
}

export class CFSubmitter extends Submitter {
  platformName = 'codeforces';
  username: string = '';
  cookie: string = '';
  csrf_token: string = '';
  useragent: string = '';

  async loginWith(account: {
    username: string;
    cookie: string;
    csrf_token: string;
    useragent: string;
  }): Promise<boolean> {
    const response = await fetch('https://codeforces.com/settings/general', {
      headers: {
        cookie: account.cookie,
      },
    });
    if (response.status !== 200) return false;
    const text = await response.text();
    if (!text.includes(account.username)) return false;
    this.username = account.username;
    this.cookie = account.cookie;
    this.csrf_token = account.csrf_token;
    this.useragent = account.useragent;
    return true;
  }

  async submit(
    { problemID, sourceCode, language }: ProblemSolution,
    uuid: string
  ) {
    const matches = problemID.match(CODEFORCES_PROBLEM_REGEX);
    if (!matches) {
      throw new HttpsError(
        'invalid-argument',
        `'${problemID}' is not a valid Codeforces problem ID`
      );
    }
    const contestId = matches[1];
    const submittedProblemIndex = matches[2];

    console.log(
      `using CF account ${this.username}, cookie: ${this.cookie}, csrf_token: ${this.csrf_token}`
    );

    const response = await fetch(
      'https://codeforces.com/problemset/submit?' +
        new URLSearchParams({ csrf_token: this.csrf_token }).toString(),
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie: this.cookie,
          Referer: 'https://codeforces.com/problemset/submit',
          'user-agent': this.useragent,
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
          csrf_token: this.csrf_token,
          ftaa: '',
          bfaa: '',
          sourceFile: '',
          _tta: '195',
        }),
        method: 'POST',
      }
    );
    const text = await response.text();
    if (
      response.status !== 200 ||
      response.url !== `https://codeforces.com/problemset/status?my=on`
    ) {
      console.log(
        'submission response.status:',
        response.url,
        response.status,
        response.statusText
      );
      console.log('submission response.text: ', text.replaceAll('\n', ''));
      throw new Error(
        'submission failed, user: ' +
          this.username +
          ', status: ' +
          response.status
      );
    }
    if (text.includes('You have submitted exactly the same code before')) {
      throw new HttpsError(
        'already-exists',
        `You have submitted exactly the same code before`
      );
    }

    console.log('submission success, fetching submission ID for uuid', uuid);
    for (let i = 0; i < MAX_GETSUBMISSIONDATA_TRIES; ++i) {
      const response = await fetch(
        `https://codeforces.com/submissions/${this.username}`
      );
      const document = cheerio.load(await response.text());
      const id = document('[data-submission-id]').attr('data-submission-id');
      if (id) {
        const response = await fetch(
          'https://codeforces.com/data/submitSource',
          {
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              cookie: this.cookie,
              Referer: 'https://codeforces.com/problemset/status?my=on',
              'user-agent': this.useragent,
            },
            body: new URLSearchParams({
              submissionId: id,
              csrf_token: this.csrf_token,
            }),
            method: 'POST',
          }
        );
        if (response.status !== 200) {
          console.log(
            'source response.status: ',
            response.status,
            response.statusText
          );
          console.log('source response.text: ', await response.text());
          throw new Error(
            'fetching submission source failed, status: ' + response.status
          );
        }
        const src: string = (await response.json())['source'];
        console.log('latest submission source: ', src.split('\n')[0]);
        if (src.includes(uuid))
          return {
            id,
            username: this.username,
            platform: 'codeforces',
          } as const;
      }
      await new Promise(r => setTimeout(r, GETSUBMISSIONDATA_DELAY_MS));
    }
    throw new TimeOutError(`fetching submission ID for uuid ${uuid} timed out`);
  }
}

export class AtCoderSubmitter extends Submitter {
  platformName = 'atcoder';
  cookie: string = '';
  csrf_token: string = '';

  async loginWith(account: {
    username: string;
    cookie: string;
    csrf_token: string;
  }): Promise<boolean> {
    const response = await fetch('https://atcoder.jp/settings', {
      headers: {
        cookie: account.cookie,
      },
    });
    console.log(response);
    if (response.status !== 200) return false;
    const text = await response.text();
    console.log(text);
    if (!text.includes(account.username)) return false;
    this.cookie = account.cookie;
    this.csrf_token = account.csrf_token;
    return true;
  }

  async submit({ problemID, sourceCode, language }: ProblemSolution) {
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
          cookie: this.cookie,
        },
        body: new URLSearchParams({
          'data.TaskScreenName': problemID,
          sourceCode,
          'data.LanguageId': {
            cpp: '5001', // C++ 20 (gcc 12.2)
            py: '5078', // Python (PyPy 3.10-v7.3.12)
            java: '5005', // Java (OpenJDK 17)
          }[language],
          csrf_token: this.csrf_token,
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
    return {
      id,
      username: null,
      platform: 'atcoder',
    } as const;
  }
}

export class CSESSubmitter extends Submitter {
  platformName = 'cses';
  cookie: string = '';
  csrf_token: string = '';

  async loginWith(account: {
    username: string;
    cookie: string;
    csrf_token: string;
  }): Promise<boolean> {
    const response = await fetch('https://cses.fi/', {
      headers: {
        cookie: account.cookie,
      },
    });
    if (response.status !== 200) return false;
    const text = await response.text();
    if (!text.includes(account.username)) return false;
    this.cookie = account.cookie;
    this.csrf_token = account.csrf_token;
    return true;
  }

  async submit({ problemID, sourceCode, language }: ProblemSolution) {
    const formData = new FormData();
    formData.append('csrf_token', this.csrf_token);
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
        cookie: this.cookie,
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
    return {
      id,
      username: null,
      platform: 'cses',
    } as const;
  }
}

export class SPOJSubmitter extends Submitter {
  platformName = 'spoj';
  username: string = '';
  cookie: string = '';
  csrf_token: string = '';

  async loginWith(account: {
    username: string;
    cookie: string;
    csrf_token: string;
  }): Promise<boolean> {
    const response = await fetch('https://www.spoj.com/myaccount/', {
      headers: {
        cookie: account.cookie,
      },
    });
    if (response.status !== 200) return false;
    const text = await response.text();
    if (!text.includes(account.username)) return false;
    this.username = account.username;
    this.cookie = account.cookie;
    this.csrf_token = account.csrf_token;
    return true;
  }

  async submit({ problemID, sourceCode, language }: ProblemSolution) {
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
        cookie: this.cookie,
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
    return {
      id,
      username: this.username,
      platform: 'spoj',
    } as const;
  }
}
