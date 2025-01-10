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

async function fetchWithProxy(
  url: string,
  init?: fetch.RequestInit
): Promise<fetch.Response> {
  return await fetch(
    loginBotUrl.value() + '/proxy?' + new URLSearchParams({ url }).toString(),
    init
  );
}

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
    const response = await fetchWithProxy(
      'https://codeforces.com/settings/general',
      {
        headers: {
          cookie: account.cookie,
          'user-agent': account.useragent,
        },
      }
    );
    if (response.status !== 200) return false;
    const text = await response.text();
    if (!text.includes(account.username)) return false;
    if (
      text.match(/name='csrf_token' value='([a-z0-9]+)'/)?.[1] !==
      account.csrf_token
    ) {
      console.log('csrf_token mismatch');
      return false;
    }
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

    const response = await fetchWithProxy(
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
    const response_url = response.headers.get('x-proxy-final-url');
    if (
      response.status !== 200 ||
      response_url !== `https://codeforces.com/problemset/status?my=on`
    ) {
      console.log(
        'submission response.status:',
        response_url,
        response.status,
        response.statusText
      );
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
      const response = await fetchWithProxy(
        `https://codeforces.com/submissions/${this.username}`,
        {
          headers: {
            cookie: this.cookie,
            'user-agent': this.useragent,
          },
        }
      );
      const document = cheerio.load(await response.text());
      const id = document('[data-submission-id]').attr('data-submission-id');
      if (id) {
        const response = await fetchWithProxy(
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
        if (response.status === 200) {
          const src: string = (await response.json())['source'];
          console.log('latest submission source: ', src.split('\n')[0]);
          if (src.includes(uuid))
            return {
              id,
              username: this.username,
              platform: 'codeforces',
            } as const;
        } else {
          console.log(
            'source response.status: ',
            response.status,
            response.statusText
          );
        }
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
    if (response.status !== 200) return false;
    const text = await response.text();
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
      throw new Error('submission failed, status: ' + response.status);
    }
    return {
      id,
      username: this.username,
      platform: 'spoj',
    } as const;
  }
}

export class PlanetsSubmitter extends Submitter {
  platformName = 'planets';
  authorization: string;

  constructor(authorization: string) {
    super();
    if (!authorization)
      throw new Error('attempt to submit to planets without logging in');
    this.authorization = authorization;
  }

  async loginWith(_: {}): Promise<boolean> {
    return true;
  }

  async submit({ problemID, sourceCode, language }: ProblemSolution) {
    const res = await fetch(
      'https://europe-west1-algopro-app.cloudfunctions.net/planetssubmit',
      {
        headers: {
          'content-type': 'application/json',
          authorization: this.authorization,
        },
        body: JSON.stringify({
          data: {
            problem_id: problemID,
            language: {
              cpp: 'cpp17',
              java: 'java',
              py: 'python3',
            }[language],
            solution: sourceCode,
          },
        }),
        method: 'POST',
      }
    );
    if (res.status !== 200) {
      throw new Error(
        'planets submission failed, status: ' +
          res.status +
          ' ' +
          (await res.json()).error.message
      );
    }
    const data = await res.json();
    return {
      id: data.result.id,
      username: null,
      platform: 'planets',
    } as const;
  }
}

export class OjuzSubmitter extends Submitter {
  platformName = 'ojuz';
  username: string = '';
  cookie: string = '';

  async loginWith(account: {
    username: string;
    cookie: string;
  }): Promise<boolean> {
    const response = await fetch('https://oj.uz/', {
      headers: {
        cookie: account.cookie,
      },
    });
    const text = await response.text();
    if (!text.includes(account.username)) return false;
    this.username = account.username;
    this.cookie = account.cookie;
    return true;
  }

  async submit({ problemID, sourceCode, language }: ProblemSolution) {
    const formData = new FormData();
    formData.append(
      'programmingLanguageId',
      {
        cpp: 'cpp20gpp', // C++20 [g++ (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0]
        py: 'python3pypy', // Pypy 3 [PyPy 7.3.10]
        java: 'javajdk', // Java [openjdk 17.0.5 2022-10-18]
      }[language]
    );
    formData.append('sourceCodeText-0', sourceCode);

    const response = await fetch(
      'https://oj.uz/problem/submit/' + problemID + '?mode=text',
      {
        headers: {
          cookie: this.cookie,
          referer: 'https://oj.uz/problem/submit/' + problemID,
          origin: 'https://oj.uz',
        },
        body: formData,
        method: 'POST',
      }
    );

    const id = (await response.json()).submissionId;
    if (!id) {
      throw new Error('submission failed, id not found');
    }

    return {
      id,
      username: this.username,
      platform: 'ojuz',
    } as const;
  }
}

export class NjudgeSubmitter extends Submitter {
  platformName = 'njudge';
  username: string = '';
  cookie: string = '';

  async loginWith(account: {
    username: string;
    cookie: string;
  }): Promise<boolean> {
    const response = await fetch('https://njudge.hu/', {
      headers: {
        cookie: account.cookie,
      },
    });
    const text = await response.text();
    if (!text.includes(account.username)) return false;
    this.username = account.username;
    this.cookie = account.cookie;
    return true;
  }

  async submit({ problemID, sourceCode, language }: ProblemSolution) {
    const csrf_response = await fetch(
      `https://njudge.hu/problemset/main/${problemID}/submit`,
      {
        headers: {
          cookie: this.cookie,
        },
      }
    );
    const csrf_token = (await csrf_response.text()).match(
      /name="_csrf" value="([a-zA-Z0-9]+)"/
    )?.[1];
    if (!csrf_token) {
      throw new Error('csrf token not found');
    }
    const formData = new FormData();
    formData.append('problem', problemID);
    formData.append('submissionCode', sourceCode);
    formData.append(
      'language',
      {
        cpp: 'cpp17',
        py: 'pypy3',
        java: 'java',
      }[language]
    );
    formData.append('_csrf', csrf_token);

    const response = await fetch('https://njudge.hu/problemset/main/submit', {
      headers: {
        cookie: this.cookie,
      },
      body: formData,
      method: 'POST',
    });

    const id = new URL(response.url).hash.slice(1);
    if (!id) {
      throw new Error('submission failed, id not found');
    }

    return {
      id,
      username: this.username,
      platform: 'njudge',
    } as const;
  }
}
