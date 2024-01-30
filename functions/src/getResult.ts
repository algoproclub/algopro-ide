import * as crypto from 'node:crypto';
import * as jsdom from 'jsdom';
import { cfAPIKey, cfAPISecret, IncorrectDataError } from './index';
import { SubmissionData } from './types';
import { StatusCode, StatusData, TestCase } from '../../src/types/problem';

const { JSDOM } = jsdom;

export abstract class ResultFetcher {
  abstract initialize(): Promise<void>;
  abstract getStatusCode(): StatusCode;
  abstract getStatusText(): string | null;
  abstract getMessage(): string;
  abstract getOutput(): string | null;
  abstract getMemory(): string | null;
  abstract getTime(): string | null;
  abstract getLink(): string | null;

  getTestCaseNum(): number {
    return 0;
  }
  getTestCaseTitle(n: number): string {
    return '?';
  }
  getTestCaseSymbol(n: number): string {
    return '?';
  }
  getTestCaseTime(n: number): string | null {
    return null;
  }
  getTestCaseMemory(n: number): string | null {
    return null;
  }
  getNthTestCase(n: number): TestCase {
    return {
      trialNum: n + 1,
      title: this.getTestCaseTitle(n),
      symbol: this.getTestCaseSymbol(n),
      memory: this.getTestCaseMemory(n),
      time: this.getTestCaseTime(n),
    };
  }
  getTestCases(): TestCase[] {
    const testCases: TestCase[] = [];
    for (let i = 0; i < this.getTestCaseNum(); ++i) {
      testCases.push(this.getNthTestCase(i));
    }
    return testCases;
  }

  async getResults(): Promise<StatusData> {
    await this.initialize();
    return {
      statusCode: this.getStatusCode(),
      statusText: this.getStatusText(),
      message: this.getMessage(),
      output: this.getOutput(),
      memory: this.getMemory(),
      time: this.getTime(),
      link: this.getLink(),
      testCases: this.getTestCases(),
    };
  }
}

export class CFResultFetcher extends ResultFetcher {
  private submission: any;

  constructor(
    private submissionData: SubmissionData,
    private resultJSON: { [key: string]: any }
  ) {
    super();
  }

  getStatusText(): string {
    return this.submission['verdict'] === 'TESTING'
      ? 'status-working'
      : 'status-done';
  }

  getStatusCode(): StatusCode {
    return this.submission['verdict'] === 'TESTING' ? 'working' : 'resolved';
  }

  getMessage(): string {
    let formatted = (this.submission['verdict'] as string)
      .split('_')
      .join(' ')
      .toLowerCase();
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
      formatted += ` on test ${this.submission['passedTestCount'] + 1}`;
    }
    return formatted;
  }

  getLink(): string {
    const { submissionID } = this.submissionData;
    return `https://codeforces.com/contest/${this.submission.contestId}/submission/${submissionID}`;
  }

  getMemory(): string | null {
    return (
      Math.round(this.submission['memoryConsumedBytes'] / 100000) / 10 + ' MB'
    );
  }

  getTime(): string | null {
    return this.submission['timeConsumedMillis'] + ' ms';
  }

  getOutput(): string | null {
    return null;
  }

  async initialize() {
    const { problemID, submissionID, username } = this.submissionData;

    if (!username) {
      throw new IncorrectDataError('CF: username is missing');
    }
    this.submission = this.resultJSON.find(
      (entry: any) => '' + entry.id === submissionID
    );
    if (!this.submission) {
      throw new IncorrectDataError(
        `CF: no such submission (username: ${username}, submission ID: ${submissionID})`
      );
    }
    const respProblemID: string =
      '' +
      this.submission.problem.contestId.toString() +
      this.submission.problem.index.toLowerCase();

    if (problemID != respProblemID) {
      throw new IncorrectDataError(
        `CF: problem IDs don't match (${problemID} - ${respProblemID})`
      );
    }
  }
}

export class AtCoderResultFetcher extends ResultFetcher {
  private static codeToVerdict = {
    CE: 'compile error',
    AC: 'correct answer',
    WA: 'incorrect answer',
    RE: 'runtime error',
    TLE: 'time limit exceeded',
    MLE: 'memory limit exceeded',
    OLE: 'output limit exceeded',
    IE: 'internal error',
  };
  private readonly headers: HeadersInit;
  private document?: Document;
  private summary?: Element;
  private testcases?: Element[];

  constructor(private submissionData: SubmissionData) {
    super();
    this.headers = {
      Cookie: submissionData.sessionCookie ?? '',
    };
  }

  private static formatMemory(text?: string | null) {
    const num = text ? parseInt(text?.split(' ')[0]) : NaN;
    return isNaN(num) ? null : Math.round(num / 100) / 10 + ' MB';
  }

  private static isValidVerdict(
    key: string
  ): key is keyof typeof AtCoderResultFetcher.codeToVerdict {
    return Object.prototype.hasOwnProperty.call(
      AtCoderResultFetcher.codeToVerdict,
      key
    );
  }

  private getSummaryCell(key: string) {
    if (!this.summary) {
      return undefined;
    }
    const tableRows = Array.from(this.summary.children);
    const tableRow = tableRows.filter(tableRow => {
      const cells = Array.from(tableRow.children);
      return cells[0]?.textContent?.toLowerCase() === key.toLowerCase();
    })[0];
    return tableRow ? Array.from(tableRow.children)[1] : undefined;
  }

  private getSummaryValue(key: string) {
    return this.getSummaryCell(key)?.textContent ?? undefined;
  }

  private getTask() {
    return this.getSummaryCell('task')
      ?.querySelector('a')
      ?.href.split('/')
      .slice(-1)[0]
      .toLowerCase();
  }

  getStatusCode(): StatusCode {
    const status = this.summary?.querySelector('td#judge-status')?.textContent;
    return status && status in AtCoderResultFetcher.codeToVerdict
      ? 'resolved'
      : 'working';
  }

  getStatusText(): string {
    const status = this.summary?.querySelector('td#judge-status')?.textContent;
    return status && status in AtCoderResultFetcher.codeToVerdict
      ? 'status-done'
      : 'status-working';
  }

  getMessage(): string {
    const status = this.summary
      ?.querySelector('td#judge-status')
      ?.textContent?.split(' ')[0];
    if (!status) {
      return 'running';
    }
    if (this.getStatusCode() === 'working') {
      let message = 'running';
      if (status.includes('/')) {
        message += ' on test ' + status.split('/')[0];
      }
      return message;
    }
    if (!AtCoderResultFetcher.isValidVerdict(status)) {
      return 'running';
    }
    return AtCoderResultFetcher.codeToVerdict[status];
  }

  getTime(): string | null {
    return this.getSummaryValue('exec time') ?? null;
  }

  getMemory(): string | null {
    return (
      AtCoderResultFetcher.formatMemory(this.getSummaryValue('memory')) ?? null
    );
  }

  getOutput(): string | null {
    return (
      this.document?.querySelector('div.col-sm-12 > pre:not(#submission-code)')
        ?.textContent ?? null
    );
  }

  getLink(): string {
    const { problemID, submissionID } = this.submissionData;
    return `https://atcoder.jp/contests/${
      problemID.split('_')[0]
    }/submissions/${submissionID}`;
  }

  getTestCaseNum(): number {
    return this.testcases ? this.testcases.length : 0;
  }

  getTestCaseTitle(n: number): string {
    if (!this.testcases) {
      return '?';
    }
    const tableRow = this.testcases[n];
    const verdict = Array.from(tableRow.children)[1]?.textContent;

    if (!verdict || !AtCoderResultFetcher.isValidVerdict(verdict)) {
      return '?';
    }
    return AtCoderResultFetcher.codeToVerdict[verdict];
  }

  getTestCaseTime(n: number): string | null {
    if (!this.testcases) {
      return null;
    }
    const tableRow = this.testcases[n];
    return Array.from(tableRow.children)[2]?.textContent ?? null;
  }

  getTestCaseMemory(n: number): string | null {
    if (!this.testcases) {
      return null;
    }
    const tableRow = this.testcases[n];
    return AtCoderResultFetcher.formatMemory(
      Array.from(tableRow.children)[3]?.textContent
    );
  }

  getTestCaseSymbol(n: number): string {
    return this.getTestCaseTitle(n) === 'correct answer' ? '✓' : 'x';
  }

  async initialize(): Promise<void> {
    const { problemID, submissionID } = this.submissionData;

    const url = `https://atcoder.jp/contests/${
      problemID.split('_')[0]
    }/submissions/${submissionID}`;

    const resp = await fetch(url, {
      headers: this.headers,
    });
    if (resp.status !== 200) {
      const errorMessage = `AtCoder: response status is not 200; url: ${url}; response status: ${resp.status}`;
      throw resp.status === 404
        ? new IncorrectDataError(errorMessage)
        : new Error(errorMessage);
    }
    const respText = await resp.text();

    this.document = new JSDOM(respText).window.document;
    this.summary = this.document.querySelectorAll(
      'table.table.table-bordered.table-striped > tbody'
    )[0];
    if (!this.summary) {
      throw new Error(
        `AtCoder: summary table is missing; url: ${url}; response text: ${respText}`
      );
    }
    this.testcases = Array.from(
      this.document.querySelectorAll(
        'table.table.table-bordered.table-striped.th-center > tbody'
      )[2]?.children ?? []
    );
    if (this.getTask() !== problemID.toLowerCase()) {
      throw new IncorrectDataError(
        `AtCoder: problem IDs don't match (${this.getTask()} - ${problemID.toLowerCase()})`
      );
    }
  }
}

export class CSESResultFetcher extends ResultFetcher {
  private readonly headers: HeadersInit;
  private document?: Document;
  private summary?: Element;
  private testcases?: Element[];

  constructor(private submissionData: SubmissionData) {
    super();
    this.headers = {
      Cookie: submissionData.sessionCookie ?? '',
    };
  }

  private getSummaryValue(key: string) {
    if (!this.summary) {
      return;
    }
    const tableRows = Array.from(this.summary.children);
    const tableRow = tableRows.filter(tableRow => {
      const cells = Array.from(tableRow.children);
      return (
        cells[0]?.textContent?.toLowerCase()?.replace(':', '') ===
        key.toLowerCase()
      );
    })[0];
    return tableRow ? Array.from(tableRow.children)[1]?.textContent : undefined;
  }

  getStatusCode(): StatusCode {
    const value = this.getSummaryValue('status');
    return value === 'READY' || value === 'COMPILE ERROR'
      ? 'resolved'
      : 'working';
  }

  getStatusText(): string {
    const value = this.getSummaryValue('status');
    return value === 'READY' || value === 'COMPILE ERROR'
      ? 'status-done'
      : 'status-working';
  }

  getMessage(): string {
    const status = this.getSummaryValue('status');
    if (!status || status === 'PENDING' || status.startsWith('TESTING')) {
      return 'running';
    }
    if (status === 'COMPILE ERROR') {
      return status.toLowerCase();
    }
    const value = this.getSummaryValue('result')?.toLowerCase();
    if (value === 'wrong answer') {
      return 'incorrect answer';
    }
    if (value === 'accepted') {
      return 'correct answer';
    }
    return value ?? '?';
  }

  getOutput(): string | null {
    if (!this.document) {
      return null;
    }
    const compilerReport = Array.from(
      this.document.querySelectorAll('div.closeable')
    ).filter(div => {
      const subtitle = div.querySelector('h3');
      return subtitle?.textContent === 'Compiler report';
    })[0];

    return compilerReport?.querySelector('pre')?.textContent ?? null;
  }

  getTime(): string | null {
    const testCases = this.getTestCases();
    if (testCases.length === 0) {
      return null;
    }
    const timeNum = Math.max.apply(
      null,
      testCases.map(item => {
        const testTime = item.time ? parseInt(item.time.split(' ')[0]) : NaN;
        return isNaN(testTime) ? Infinity : testTime;
      })
    );
    return (timeNum === Infinity ? '∞' : '' + timeNum) + ' ms';
  }

  getMemory(): string | null {
    return null;
  }

  getLink(): string | null {
    return null;
  }

  getTestCaseNum(): number {
    return this.testcases ? this.testcases.length : 0;
  }

  getTestCaseTitle(n: number): string {
    if (!this.testcases) {
      return '?';
    }
    const verdict = Array.from(
      this.testcases[n].children
    )[1].textContent?.toLowerCase();
    if (verdict === 'wrong answer') {
      return 'incorrect answer';
    }
    if (verdict === 'accepted') {
      return 'correct answer';
    }
    return verdict ?? '?';
  }

  getTestCaseTime(n: number): string {
    if (!this.testcases) {
      return '?';
    }
    const time =
      Array.from(this.testcases[n].children)[2].textContent?.toLowerCase() ??
      null;

    if (!time) {
      return '?';
    }
    if (time === '--') {
      return '∞ ms';
    }
    const num = parseFloat(time.substring(0, time.length - 1).trim()) * 1000;
    return isNaN(num) ? '?' : num + ' ms';
  }

  getTestCaseSymbol(n: number): string {
    const verdict = this.getTestCaseTitle(n);
    return verdict === 'correct answer' ? '✓' : 'x';
  }

  async initialize() {
    const { submissionID } = this.submissionData;

    const url = `https://cses.fi/problemset/result/${submissionID}/`;
    const resp = await fetch(url, { headers: this.headers });
    if (resp.status !== 200) {
      throw new Error(
        `CSES: response status is not 200; url: ${url}; response status: ${resp.status}`
      );
    }
    const respText = await resp.text();

    this.document = new JSDOM(respText).window.document;
    this.summary =
      this.document.querySelector('table.summary-table > tbody') ?? undefined;
    if (!this.summary) {
      throw new Error(
        `CSES: summary table not found; url: ${url}; response text: ${respText}`
      );
    }
    this.testcases = Array.from(
      this.document.querySelector('table.narrow.closeable > tbody')?.children ??
        []
    );
  }
}

export const getCFRequestURL = (
  methodName: string,
  params: { [key: string]: any }
) => {
  const genRandStr = (len: number) => {
    let result = '';
    for (let i = 0; i < len; ++i) {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const index = Math.floor(Math.random() * 36);
      result += chars[index];
    }
    return result;
  };

  const getQueryStr = (params: { [key: string]: any }) => {
    const arr = Object.entries(params).sort((param1, param2) => {
      const keyComparison = param1[0].localeCompare(param2[0]);
      return keyComparison !== 0
        ? keyComparison
        : `${param1[1]}`.localeCompare(`${param2[1]}`);
    });
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
