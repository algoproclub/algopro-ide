const admin = require('firebase-admin');
const jsdom = require('jsdom');
const crypto = require('node:crypto');
const { logger } = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineString } = require('firebase-functions/params');
const { JSDOM } = jsdom;

class IncorrectDataError extends Error {}

admin.initializeApp({
  databaseURL: 'http://localhost:9000/?ns=algopro-app-default-rtdb',
});
const db = admin.database();

const cfAPIKey = defineString('CF_API_KEY');
const cfAPISecret = defineString('CF_API_SECRET');
const atCoderCookie = defineString('ATCODER_COOKIE');
const csesCookie = defineString('CSES_COOKIE');

const accountData = {
  atcoder: {
    sessionCookie: atCoderCookie,
  },
  cses: {
    sessionCookie: csesCookie,
  },
  codeforces: {},
};

const getResultCSES = async submissionData => {
  const { submissionID, sessionCookie } = submissionData;
  const getTestcaseTitle = tr => {
    const verdict = Array.from(tr.children)[1]?.textContent?.toLowerCase();
    if (verdict === 'wrong answer') {
      return 'incorrect answer';
    }
    if (verdict === 'accepted') {
      return 'correct answer';
    }
    return verdict;
  };
  const getTestcaseTime = tr => {
    const time = Array.from(tr.children)[2]?.textContent;
    if (time === '--') {
      return '∞ ms';
    }
    const num = parseFloat(time.substring(0, time.length - 1).trim()) * 1000;
    return isNaN(num) ? time : num + ' ms';
  };
  const getTestcaseSymbol = tr => {
    const verdict = getTestcaseTitle(tr);
    return verdict === 'correct answer' ? '✓' : 'x';
  };
  const getSummaryValue = (tbody, key) => {
    const trs = Array.from(tbody.children);
    const tr = trs.filter(tr => {
      const tds = Array.from(tr.children);
      return (
        tds[0]?.textContent?.toLowerCase()?.replace(':', '') ===
        key.toLowerCase()
      );
    })[0];
    return tr ? Array.from(tr.children)[1]?.textContent : undefined;
  };
  const getStatusText = tbody => {
    const value = getSummaryValue(tbody, 'status');
    return value === 'READY' || value === 'COMPILE ERROR'
      ? 'status-done'
      : 'status-working';
  };
  const getMessage = tbody => {
    const status = getSummaryValue(tbody, 'status');
    if (status === 'COMPILE ERROR') {
      return status.toLowerCase();
    }
    if (status === 'PENDING' || status.startsWith('TESTING')) {
      return 'running';
    }
    const value = getSummaryValue(tbody, 'result')?.toLowerCase();
    if (value === 'wrong answer') {
      return 'incorrect answer';
    }
    if (value === 'accepted') {
      return 'correct answer';
    }
    return value;
  };
  const getStatusCode = tbody => {
    const value = getSummaryValue(tbody, 'status');
    return value === 'READY' || value === 'COMPILE ERROR' ? 0 : -8;
  };
  const getOutput = root => {
    const compilerReport = Array.from(
      root.querySelectorAll('div.closeable')
    ).filter(div => {
      const h3 = div.querySelector('h3');
      return h3?.textContent === 'Compiler report';
    })[0];
    return compilerReport?.querySelector('pre')?.textContent;
  };
  const headers = {
    Cookie: sessionCookie,
  };
  const resp = await fetch(
    `https://cses.fi/problemset/result/${submissionID}/`,
    { headers: headers }
  );
  const text = await resp.text();
  const root = new JSDOM(text).window.document;

  const summaryTbody = root.querySelector('table.summary-table > tbody');
  const data = {
    statusText: getStatusText(summaryTbody) ?? null,
    statusCode: getStatusCode(summaryTbody) ?? null,
    message: getMessage(summaryTbody) ?? null,
    output: getOutput(root) ?? null,
  };
  const testCases = [];
  const testCasesTbody = root.querySelector('table.narrow.closeable > tbody');

  if (testCasesTbody) {
    Array.from(testCasesTbody.children).forEach((tr, index) => {
      testCases.push({
        trialNum: index + 1,
        title: getTestcaseTitle(tr) ?? null,
        symbol: getTestcaseSymbol(tr) ?? null,
        time: getTestcaseTime(tr) ?? null,
      });
    });
    data.time = Math.max.apply(
      null,
      testCases.map(item => {
        const num = parseInt(item.time.split(' ')[0]);
        return isNaN(num) ? Infinity : num;
      })
    );
    if (data.time === Infinity) {
      data.time = '∞';
    }
    data.time += ' ms';
  }
  data.testCases = testCases;
  return data;
};

const getResultAtCoder = async (submissionData, options = undefined) => {
  const { problemID, submissionID, sessionCookie } = submissionData;
  const formatMemory = text => {
    const num = parseInt(text?.split(' ')[0]);
    if (!isNaN(num)) {
      return Math.round(num / 1000) + ' MB';
    }
  };
  const getSummaryCell = (tbody, key) => {
    const trs = Array.from(tbody.children);
    const tr = trs.filter(tr => {
      const tds = Array.from(tr.children);
      return tds[0]?.textContent?.toLowerCase() === key.toLowerCase();
    })[0];
    return tr ? Array.from(tr.children)[1] : undefined;
  };
  const getSummaryValue = (tbody, key) => {
    return getSummaryCell(tbody, key)?.textContent;
  };
  const getTestcaseTitle = tr => {
    const verdict = Array.from(tr.children)[1]?.textContent;
    return codeToVerdict[verdict];
  };
  const getTestcaseTime = tr => {
    return Array.from(tr.children)[2]?.textContent;
  };
  const getTestcaseMemory = tr => {
    return formatMemory(Array.from(tr.children)[3]?.textContent);
  };
  const getStatusText = tbody => {
    const status = tbody.querySelector('td#judge-status').textContent;
    if (!(status in codeToVerdict)) {
      return 'status-working';
    } else {
      return 'status-done';
    }
  };
  const getMessage = tbody => {
    const status = tbody
      .querySelector('td#judge-status')
      .textContent.split(' ')[0];

    if (getStatusCode(tbody) === -8) {
      let message = 'running';
      if (status.includes('/')) {
        message += ' on test ' + status.split('/')[0];
      }
      return message;
    }
    return codeToVerdict.hasOwnProperty(status)
      ? codeToVerdict[status]
      : 'running';
  };
  const getStatusCode = tbody => {
    const status = tbody.querySelector('td#judge-status').textContent;
    if (!(status in codeToVerdict)) {
      return -8;
    } else {
      return 0;
    }
  };
  const getTime = tbody => {
    return getSummaryValue(tbody, 'exec time');
  };
  const getMemory = tbody => {
    return formatMemory(getSummaryValue(tbody, 'memory'));
  };
  const getTask = tbody => {
    return getSummaryCell(tbody, 'task')
      .querySelector('a')
      .href.split('/')
      .slice(-1)[0]
      .toLowerCase();
  };
  const getOutput = root => {
    return root.querySelector('div.col-sm-12 > pre:not(#submission-code)')
      ?.textContent;
  };
  const getLink = () => {
    return `https://atcoder.jp/contests/${
      problemID.split('_')[0]
    }/submissions/${submissionID}`;
  };
  const codeToVerdict = {
    CE: 'compile error',
    AC: 'correct answer',
    WA: 'incorrect answer',
    RE: 'runtime error',
    TLE: 'time limit exceeded',
    MLE: 'memory limit exceeded',
    OLE: 'output limit exceeded',
    IE: 'internal error',
  };
  const headers = {
    Cookie: sessionCookie,
  };
  const resp = await fetch(
    `https://atcoder.jp/contests/${
      problemID.split('_')[0]
    }/submissions/${submissionID}`,
    { headers: headers }
  );
  if (resp.status === 404) {
    throw new IncorrectDataError();
  }
  if (resp.status !== 200) {
    throw new Error();
  }
  const text = await resp.text();
  const root = new JSDOM(text).window.document;

  const summaryTbody = root.querySelectorAll(
    'table.table.table-bordered.table-striped > tbody'
  )[0];
  if (getTask(summaryTbody) !== problemID.toLowerCase()) {
    throw new IncorrectDataError();
  }
  const data = {
    statusText: getStatusText(summaryTbody) ?? null,
    statusCode: getStatusCode(summaryTbody) ?? null,
    message: getMessage(summaryTbody) ?? null,
    time: getTime(summaryTbody) ?? null,
    memory: getMemory(summaryTbody) ?? null,
    output: getOutput(root) ?? null,
    link: getLink(),
  };
  const testCases = [];
  const testCasesTbody = root.querySelectorAll(
    'table.table.table-bordered.table-striped.th-center > tbody'
  )[2];

  if (testCasesTbody) {
    Array.from(testCasesTbody.children).forEach((tr, index) => {
      testCases.push({
        trialNum: index + 1,
        title: getTestcaseTitle(tr) ?? null,
        symbol: getTestcaseTitle(tr) === 'correct answer' ? '✓' : 'x',
        time: getTestcaseTime(tr) ?? null,
        memory: getTestcaseMemory(tr) ?? null,
      });
    });
  }
  data.testCases = testCases;
  return data;
};

const getCFRequestURL = (methodName, params) => {
  const genRandStr = len => {
    let result = '';
    for (let i = 0; i < len; ++i) {
      result += 'abcdefghijklmnopqrstuvwxyz0123456789'[
        Math.floor(Math.random() * 36)
      ];
    }
    return result;
  };
  const getQueryStr = params => {
    const arr = Object.entries(params).sort((a, b) =>
      `${a[0]}&${a[1]}` < `${b[0]}&${b[1]}` ? -1 : 1
    );
    return arr.map(item => `${item[0]}=${item[1]}`).join('&');
  };
  params['apiKey'] = cfAPIKey.value();
  params['time'] = Math.round(Date.now() / 1000);

  const secret = cfAPISecret.value();
  const randStr = genRandStr(6);
  const queryStr = methodName + '?' + getQueryStr(params);
  params['apiSig'] =
    randStr +
    crypto
      .createHash('sha512')
      .update(randStr + '/' + queryStr + '#' + secret)
      .digest('hex');

  return `https://codeforces.com/api/${methodName}?${getQueryStr(params)}`;
};

const getResultCF = async (submissionData, options = undefined) => {
  let resultJSON = options?.resultJSON;
  let { problemID, submissionID, username } = submissionData;
  const getStatusText = submission => {
    return submission['verdict'] === 'TESTING'
      ? 'status-working'
      : 'status-done';
  };
  const getStatusCode = submission => {
    return submission['verdict'] === 'TESTING' ? -8 : 0;
  };
  const getMessage = submission => {
    let formatted = submission['verdict'].replaceAll('_', ' ').toLowerCase();
    if (formatted === 'testing') {
      return 'running';
    }
    if (formatted === 'ok') {
      return 'correct answer';
    }
    if (
      [
        'wrong answer',
        'runtime error',
        'time limit exceeded',
        'presentation error',
        'memory limit exceeded',
        'idleness limit exceeded',
      ].includes(formatted)
    ) {
      formatted += ` on test ${submission['passedTestCount'] + 1}`;
    }
    return formatted;
  };
  const getLink = submission => {
    return `https://codeforces.com/contest/${submission.contestId}/submission/${submissionID}`;
  };
  if (!resultJSON) {
    const resp = await fetch(
      getCFRequestURL('user.status', {
        handle: username,
      })
    );
    if (resp.status === 400) {
      throw new IncorrectDataError();
    }
    if (resp.status !== 200) {
      throw new Error();
    }
    resultJSON = (await resp.json())['result'];
  }
  const submission = resultJSON.find(entry => '' + entry.id === submissionID);
  if (
    !submission ||
    '' + submission.problem.contestId !== problemID.split('_')[0] ||
    submission.problem.index.toLowerCase() !==
      problemID.split('_')[1].toLowerCase()
  ) {
    throw new IncorrectDataError();
  }
  return {
    statusText: getStatusText(submission),
    statusCode: getStatusCode(submission),
    message: getMessage(submission),
    memory: Math.round(submission['memoryConsumedBytes'] / 1000000, 2) + ' MB',
    time: submission['timeConsumedMillis'] + ' ms',
    link: getLink(submission),
  };
};

const updateStatusData = async (id, statusData) => {
  const updates = {};
  updates[`submissions/${id}/statusData`] = statusData;
  if (statusData.statusCode > -8) {
    updates[`submissions/pending/${id}`] = null;
  }
  await db.ref().update(updates);
};

const getAndUpdate = async (getResult, submissionData, options = undefined) => {
  try {
    const data = await getResult(submissionData, options);
    await updateStatusData(submissionData.fileID, data);
  } catch (error) {
    if (error instanceof IncorrectDataError) {
      await updateStatusData(submissionData.fileID, {
        statusCode: -1,
      });
    } else {
      await updateStatusData(submissionData.fileID, {
        statusCode: -2,
      });
    }
  }
};

const updateResult = async submissionData => {
  if (submissionData.platform === 'cses') {
    await getAndUpdate(getResultCSES, submissionData);
  }
  if (submissionData.platform === 'atcoder') {
    await getAndUpdate(getResultAtCoder, submissionData);
  }
};

const updateResultsCF = async submissionDataList => {
  if (!submissionDataList || submissionDataList.length === 0) {
    return;
  }
  const sorted = submissionDataList.sort(
    (a, b) => a.creationTime - b.creationTime
  );
  const username = sorted[0].username;
  const resp = await fetch(
    getCFRequestURL('user.status', {
      handle: username,
    })
  );
  if (resp.status === 400) {
    submissionDataList.forEach(submissionData => {
      updateStatusData(submissionData.fileID, {
        statusCode: -1,
      });
    });
  }
  if (resp.status !== 200) {
    submissionDataList.forEach(submissionData => {
      updateStatusData(submissionData.fileID, {
        statusCode: -2,
      });
    });
  }
  const resultJSON = (await resp.json())['result'];
  console.log(resultJSON);
  const promises = [];
  submissionDataList.forEach(submissionData => {
    promises.push(
      getAndUpdate(getResultCF, submissionData, { resultJSON: resultJSON })
    );
  });
  await Promise.all(promises);
};

const updateResults = async pending => {
  const readSubmissionData = async pending => {
    const submissionData = [];
    for (let fileID of Object.keys(pending)) {
      const creationTime = pending[fileID].creationTime;
      const fileData = (await db.ref(`files/${fileID}`).get()).val();
      const platform = fileData.problem.platform;
      const problemID = fileData.problem.id;
      const submissionID = fileData.submission.id;
      const username = fileData.submission.username;

      submissionData.push({
        fileID: fileID,
        platform: platform,
        username: username,
        sessionCookie: accountData[platform]?.sessionCookie?.value(),
        problemID: problemID,
        submissionID: submissionID,
        creationTime: creationTime,
      });
    }
    return submissionData;
  };
  if (!pending) {
    return;
  }
  const pendingData = await readSubmissionData(pending);
  const pendingByPlatform = pendingData.reduce((accumulator, person) => {
    const platform = person.platform;
    if (!accumulator[platform]) {
      accumulator[platform] = [];
    }
    accumulator[platform].push(person);
    return accumulator;
  }, {});

  const promises = [];
  pendingByPlatform['cses']?.forEach(obj => {
    promises.push(updateResult(obj));
  });
  pendingByPlatform['atcoder']?.forEach(obj => {
    promises.push(updateResult(obj));
  });
  promises.push(updateResultsCF(pendingByPlatform['codeforces']));
  await Promise.all(promises);
};

exports.scheduledUpdate = onSchedule('every 2 seconds', async () => {
  let startNewUpdate = false;
  await db.ref('submissions/lock').transaction(lock => {
    startNewUpdate = !lock;
    return true;
  });
  if (!startNewUpdate) {
    return;
  }
  try {
    await db.ref('submissions/pending').once('value', async snapshot => {
      await updateResults(snapshot.val());
    });
  } catch (error) {
    logger.log(error);
  } finally {
    await db.ref('submissions/lock').set(null);
  }
});
