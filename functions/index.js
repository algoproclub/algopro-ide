/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { pubsub } = require('firebase-functions');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

admin.initializeApp({
  databaseURL: 'http://localhost:9000/?ns=algopro-app-default-rtdb',
});
const db = admin.database();

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

const getResultsCSES = async (submissionID, sessionCookie) => {
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
  const root = new JSDOM(await resp.text()).window.document;

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

const getResultsAtCoder = async (problemID, submissionID, sessionCookie) => {
  const formatMemory = text => {
    const num = parseInt(text?.split(' ')[0]);
    if (!isNaN(num)) {
      return Math.round(num / 1000) + ' MB';
    }
  };
  const getSummaryValue = (tbody, key) => {
    const trs = Array.from(tbody.children);
    const tr = trs.filter(tr => {
      const tds = Array.from(tr.children);
      return tds[0]?.textContent?.toLowerCase() === key.toLowerCase();
    })[0];
    return tr ? Array.from(tr.children)[1]?.textContent : undefined;
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
    if (getStatusCode(tbody) === -8) {
      return 'running';
    }
    const status = tbody.querySelector('td#judge-status').textContent;
    return status in codeToVerdict ? codeToVerdict[status] : 'running';
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
    WJ: 'running',
    CE: 'compile error',
    AC: 'correct answer',
    WA: 'incorrect answer',
    RTE: 'runtime error',
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
  const text = await resp.text();
  const root = new JSDOM(text).window.document;

  const summaryTbody = root.querySelectorAll(
    'table.table.table-bordered.table-striped > tbody'
  )[0];
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
  console.log(data);
  return data;
};

const getResultsCF = async (username, submissionID, resultJSON = undefined) => {
  const getStatusText = submission => {
    return submission['verdict'] === 'TESTING'
      ? 'status-working'
      : 'status-done';
  };
  const getStatusCode = submission => {
    return submission['verdict'] === 'TESTING' ? -8 : 0;
  };
  const getMessage = submission => {
    if (['TESTING'].includes(submission['verdict'])) {
      return submission['verdict'];
    }
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
      `https://codeforces.com/api/user.status?handle=${username}`
    );
    resultJSON = (await resp.json())['result'];
  }
  const submission = resultJSON.find(entry => '' + entry.id === submissionID);

  return {
    statusText: getStatusText(submission),
    statusCode: getStatusCode(submission),
    message: getMessage(submission),
    memory: Math.round(submission['memoryConsumedBytes'] / 1000000, 2) + ' MB',
    time: submission['timeConsumedMillis'] + ' ms',
    link: getLink(submission),
  };
};

const updateResults = async pending => {
  const getMultipleResultsCF = async (username, idPairs) => {
    const resp = await fetch(
      `https://codeforces.com/api/user.status?handle=${username}`
    );
    const resultJSON = (await resp.json())['result'];

    console.log(idPairs);
    idPairs.forEach(pair => {
      getResultsCF(username, pair.submissionID, resultJSON).then(data =>
        updateData(pair.fileID, data)
      );
    });
  };
  const getSubmissionsWithUsername = async (ids, username) => {
    const submissionIDs = [];
    for (const id of ids) {
      const currUsername = (
        await db.ref(`files/${id}/platform/user`).get()
      ).val();
      const currSubmissionID = (
        await db.ref(`files/${id}/submission/id`).get()
      ).val();
      if (currUsername === username) {
        submissionIDs.push({
          fileID: id,
          submissionID: currSubmissionID,
        });
      }
    }
    return submissionIDs;
  };
  const updateData = (id, data) => {
    const updates = {};
    updates[`submissions/${id}/statusData`] = data;
    if (data.statusCode === 0) {
      updates[`submissions/pending/${id}`] = null;
    }
    db.ref().update(updates);
  };
  if (!pending) {
    return;
  }
  const sorted = Object.fromEntries(
    Object.entries(pending).sort(
      ([, a], [, b]) => a.creationTime - b.creationTime
    )
  );
  const ids = Object.keys(sorted);
  if (ids.length === 0) {
    return;
  }
  const id = ids[0];
  const platform = (await db.ref(`files/${id}/platform`).get()).val();
  const platformName = platform.name;
  const username = platform.user;
  const problemID = (await db.ref(`files/${id}/problem/id`).get()).val();
  const submissionID = (await db.ref(`files/${id}/submission/id`).get()).val();
  const sessionCookie = (
    await db.ref(`accounts/${platformName}/sessionCookie`).get()
  ).val();

  if (platformName === 'CF') {
    const submissionIDs = await getSubmissionsWithUsername(ids, username);
    await getMultipleResultsCF(username, submissionIDs);
  }
  if (platformName === 'CSES') {
    getResultsCSES(submissionID, sessionCookie).then(data => {
      updateData(id, data);
    });
  }
  if (platformName === 'AtCoder') {
    getResultsAtCoder(problemID, submissionID, sessionCookie).then(data => {
      updateData(id, data);
    });
  }
};

exports.scheduledUpdate = pubsub
  .schedule('every 2 seconds')
  .timeZone('UTC')
  .onRun(() => {
    return db.ref('submissions/pending').once('value', snapshot => {
      updateResults(snapshot.val());
    });
  });
