import * as crypto from 'node:crypto';
import * as jsdom from 'jsdom';
import { StatusData, TestCase } from '../../src/components/Workspace/Workspace';
import { IncorrectDataError, cfAPIKey, cfAPISecret } from './index';
import { SubmissionData } from './types';

const { JSDOM } = jsdom;

export abstract class ResultFetcher {
  abstract initialize(): Promise<void>;

  abstract getStatusCode(): number;
  abstract getStatusText(): string | undefined;
  abstract getMessage(): string;
  abstract getOutput(): string | undefined;
  abstract getMemory(): string | undefined;
  abstract getTime(): string | undefined;
  abstract getLink(): string | undefined;

  private static withEntry<T extends Record<string, any>>(
    obj: T,
    key: string,
    val: any
  ): T {
    return val ? { ...obj, [key]: val } : obj;
  }

  getTestCaseNum(): number {
    return 0;
  }
  getTestCaseTitle(n: number): string {
    return '?';
  }
  getTestCaseSymbol(n: number): string {
    return '?';
  }
  getTestCaseTime(n: number): string | undefined {
    return;
  }
  getTestCaseMemory(n: number): string | undefined {
    return;
  }
  getNthTestCase(n: number): TestCase {
    let testCase: TestCase = {
      trialNum: n + 1,
      title: this.getTestCaseTitle(n),
      symbol: this.getTestCaseSymbol(n),
    };
    testCase = ResultFetcher.withEntry(
      testCase,
      'time',
      this.getTestCaseTime(n)
    );
    testCase = ResultFetcher.withEntry(
      testCase,
      'memory',
      this.getTestCaseMemory(n)
    );
    return testCase;
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
    let statusData: StatusData = {
      statusCode: this.getStatusCode(),
      message: this.getMessage(),
    };
    statusData = ResultFetcher.withEntry(
      statusData,
      'statusText',
      this.getStatusText()
    );
    statusData = ResultFetcher.withEntry(
      statusData,
      'output',
      this.getOutput()
    );
    statusData = ResultFetcher.withEntry(
      statusData,
      'memory',
      this.getMemory()
    );
    statusData = ResultFetcher.withEntry(statusData, 'time', this.getTime());
    statusData = ResultFetcher.withEntry(statusData, 'link', this.getLink());
    statusData = ResultFetcher.withEntry(
      statusData,
      'testCases',
      this.getTestCases()
    );
    return statusData;
  }
}

export class CFResultFetcher extends ResultFetcher {
  private submission: any;

  constructor(
    private submissionData: SubmissionData,
    private resultJSON: { [k: string]: any }
  ) {
    super();
  }

  getStatusText(): string {
    return this.submission['verdict'] === 'TESTING'
      ? 'status-working'
      : 'status-done';
  }

  getStatusCode(): number {
    return this.submission['verdict'] === 'TESTING' ? -8 : 0;
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

  getMemory(): string | undefined {
    return (
      Math.round(this.submission['memoryConsumedBytes'] / 100000) / 10 + ' MB'
    );
  }

  getTime(): string | undefined {
    return this.submission['timeConsumedMillis'] + ' ms';
  }

  getOutput(): string | undefined {
    return undefined;
  }

  async initialize() {
    const { problemID, submissionID, username } = this.submissionData;

    if (!username) {
      throw new IncorrectDataError();
    }
    if (!this.resultJSON) {
      const resp = await fetch(
        getCFRequestURL('user.status', {
          handle: username,
        })
      );
      if (resp.status !== 200) {
        throw resp.status === 400 ? new IncorrectDataError() : new Error();
      }
      this.resultJSON = ((await resp.json()) as any)['result'];
    }
    this.submission = this.resultJSON.find(
      (entry: any) => '' + entry.id === submissionID
    );
    if (
      !this.submission ||
      this.submission.problem.contestId.toString() !==
        problemID.split('_')[0] ||
      this.submission.problem.index.toLowerCase() !==
        problemID.split('_')[1].toLowerCase()
    ) {
      throw new IncorrectDataError();
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
  private document: Document | undefined;
  private summary: Element | undefined;
  private testcases: Element[] | undefined;

  constructor(private submissionData: SubmissionData) {
    super();
    this.headers = {
      Cookie: submissionData.sessionCookie ?? '',
    };
  }

  private static formatMemory(text?: string | null) {
    const num = text ? parseInt(text?.split(' ')[0]) : NaN;
    return isNaN(num) ? undefined : Math.round(num / 100) / 10 + ' MB';
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

  getStatusCode(): number {
    const status = this.summary?.querySelector('td#judge-status')?.textContent;
    return status && status in AtCoderResultFetcher.codeToVerdict ? 0 : -8;
  }

  getStatusText(): string | undefined {
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
    if (this.getStatusCode() === -8) {
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

  getTime(): string | undefined {
    return this.getSummaryValue('exec time');
  }

  getMemory(): string | undefined {
    return AtCoderResultFetcher.formatMemory(this.getSummaryValue('memory'));
  }

  getOutput(): string | undefined {
    return (
      this.document?.querySelector('div.col-sm-12 > pre:not(#submission-code)')
        ?.textContent ?? undefined
    );
  }

  getLink(): string | undefined {
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

  getTestCaseTime(n: number): string | undefined {
    if (!this.testcases) {
      return undefined;
    }
    const tableRow = this.testcases[n];
    return Array.from(tableRow.children)[2]?.textContent ?? undefined;
  }

  getTestCaseMemory(n: number): string | undefined {
    if (!this.testcases) {
      return undefined;
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

    const resp = await fetch(
      `https://atcoder.jp/contests/${
        problemID.split('_')[0]
      }/submissions/${submissionID}`,
      {
        headers: this.headers,
      }
    );
    if (resp.status !== 200) {
      throw resp.status === 404 ? new IncorrectDataError() : new Error();
    }
    this.document = new JSDOM(await resp.text()).window.document;
    this.summary = this.document.querySelectorAll(
      'table.table.table-bordered.table-striped > tbody'
    )[0];
    if (!this.summary) {
      throw new Error();
    }
    this.testcases = Array.from(
      this.document.querySelectorAll(
        'table.table.table-bordered.table-striped.th-center > tbody'
      )[2]?.children ?? []
    );
    if (this.getTask() !== problemID.toLowerCase()) {
      throw new IncorrectDataError();
    }
  }
}

export class CSESResultFetcher extends ResultFetcher {
  private readonly headers: HeadersInit;
  private document: Document | undefined;
  private summary: Element | undefined;
  private testcases: Element[] | undefined;

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

  getStatusCode(): number {
    const value = this.getSummaryValue('status');
    return value === 'READY' || value === 'COMPILE ERROR' ? 0 : -8;
  }

  getStatusText(): string | undefined {
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

  getOutput(): string | undefined {
    if (!this.document) {
      return;
    }
    const compilerReport = Array.from(
      this.document.querySelectorAll('div.closeable')
    ).filter(div => {
      const subtitle = div.querySelector('h3');
      return subtitle?.textContent === 'Compiler report';
    })[0];

    return compilerReport?.querySelector('pre')?.textContent ?? undefined;
  }

  getTime(): string | undefined {
    const testCases = this.getTestCases();
    if (testCases.length === 0) {
      return undefined;
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

  getMemory(): string | undefined {
    return undefined;
  }

  getLink(): string | undefined {
    return undefined;
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

  getTestCaseTime(n: number): string | undefined {
    if (!this.testcases) {
      return '?';
    }
    const time = Array.from(
      this.testcases[n].children
    )[2].textContent?.toLowerCase();
    if (time === '--') {
      return '∞ ms';
    }
    const num = time
      ? parseFloat(time.substring(0, time.length - 1).trim()) * 1000
      : NaN;
    return isNaN(num) ? time : num + ' ms';
  }

  getTestCaseSymbol(n: number): string {
    const verdict = this.getTestCaseTitle(n);
    return verdict === 'correct answer' ? '✓' : 'x';
  }

  async initialize() {
    const { submissionID } = this.submissionData;

    const resp = await fetch(
      `https://cses.fi/problemset/result/${submissionID}/`,
      { headers: this.headers }
    );
    if (resp.status !== 200) {
      throw new Error();
    }
    this.document = new JSDOM(await resp.text()).window.document;
    this.summary =
      this.document.querySelector('table.summary-table > tbody') ?? undefined;
    if (!this.summary) {
      throw new Error();
    }
    this.testcases = Array.from(
      this.document.querySelector('table.narrow.closeable > tbody')?.children ??
        []
    );
  }
}

export const getCFRequestURL = (
  methodName: string,
  params: { [k: string]: any }
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

  const getQueryStr = (params: { [k: string]: any }) => {
    const arr = Object.entries(params).sort((a, b) => {
      const keyComparison = a[0].localeCompare(b[0]);
      return keyComparison !== 0
        ? keyComparison
        : `${a[1]}`.localeCompare(`${b[1]}`);
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
