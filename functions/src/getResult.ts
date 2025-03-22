import * as crypto from 'node:crypto';
import * as jsdom from 'jsdom';
import { cfAPIKey, cfAPISecret, IncorrectDataError } from './index';
import { SubmissionData } from './types';
import { StatusCode, StatusData, TestCase } from '../../src/types/problem';
import { getFirestore } from 'firebase-admin/firestore';

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

  constructor(readonly submissionData: SubmissionData) {}

  getTestCaseNum(): number {
    return 0;
  }
  getTestCaseTitle(_: number): string {
    return '?';
  }
  getTestCaseSymbol(_: number): string {
    return '?';
  }
  getTestCaseTime(_: number): string | null {
    return null;
  }
  getTestCaseMemory(_: number): string | null {
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

export class NJudgeResultFetcher extends ResultFetcher {
  private document?: Document;
  private summary: Element | null = null;
  private testcases?: Element[];

  translateMessage(msg?: string | null): string | undefined {
    if (!msg) return undefined;
    const prefix = msg.split(/\d/)[0].trim().toLowerCase();
    //const rest = msg.substring(prefix.length);

    const translatePrefix = (prefix: string): string => {
      switch (prefix) {
        case 'elfogadva':
          return 'correct answer';
        case 'hibás válasz':
          return 'incorrect answer';
        case 'időlimit túllépés':
          return 'time limit exceeded';
        case 'memórialimit túllépés':
          return 'memory limit exceeded';
        case 'részben helyes':
          return 'partially correct';
        case 'futási hiba':
          return 'runtime error';
        case 'forditási hiba':
          return 'compilation error';
        case 'belső hiba':
          return 'unknown error';
        case 'feltöltve':
          return 'starting';
        case 'fut':
          return 'running';
      }
      return '?';
    };
    return translatePrefix(prefix) /* + " " + rest*/;
  }

  formatTime(time?: string | null): string | undefined {
    return time?.replace(/(\d)([a-zA-Z])/g, '$1 $2');
  }

  formatMemory(memory?: string | null): string | undefined {
    return memory?.replace(
      /(\d+)\s*KiB/i,
      (_, num) => `${((+num * 1024) / 1000000).toFixed(2)} MB`
    );
  }

  getLink(): string | null {
    return `https://njudge.hu/submission/${this.submissionData.submissionID}`;
  }

  getMemory(): string | null {
    return this.formatMemory(this.summary?.childNodes[7].textContent) ?? null;
  }

  getMessage(): string {
    return (
      this.translateMessage(this.summary?.childNodes[5].textContent) ??
      'running'
    );
  }

  getOutput(): string | null {
    return (
      this.document?.querySelector(
        `#submissionFeedback${this.submissionData.submissionID} .card .card-body pre code`
      )?.textContent ?? null
    );
  }

  getStatusCode(): StatusCode {
    const verdict = this.summary?.childNodes[5].textContent ?? null;
    if (verdict == null || verdict.startsWith('Feltöltve')) {
      return 'starting';
    }
    return verdict.startsWith('Fut ') ? 'working' : 'resolved';
  }

  getTestCaseNum(): number {
    return this.testcases?.length ?? 0;
  }

  getTestCaseTitle(n: number): string {
    if (!this.testcases) return '';
    return (
      this.translateMessage(this.testcases[n].childNodes[1].textContent) ?? ''
    );
  }

  getTestCaseTime(n: number): string {
    if (!this.testcases) return '';
    const li = this.testcases[n].childNodes;
    return this.formatTime(li[li.length - 2].textContent) ?? '';
  }

  getTestCaseMemory(n: number): string {
    if (!this.testcases) return '';
    const li = this.testcases[n].childNodes;
    return this.formatMemory(li[li.length - 1].textContent) ?? '';
  }

  getTestCaseSymbol(n: number): string {
    return this.getTestCaseTitle(n) === 'correct answer' ? '✓' : 'x';
  }

  getStatusText(): string | null {
    switch (this.getStatusCode()) {
      case 'starting':
        return 'status-starting';
      case 'working':
        return 'status-working';
      case 'resolved':
        return 'status-done';
    }
    return 'status-starting';
  }

  getTime(): string | null {
    return this.formatTime(this.summary?.childNodes[6].textContent) ?? null;
  }

  async initialize(): Promise<void> {
    const { submissionID } = this.submissionData;

    const url = `https://njudge.hu/submission/${submissionID}`;
    const resp = await fetch(url);
    if (resp.status !== 200) {
      const errorMessage = `NJudge: response status is not 200; url: ${url}; response status: ${resp.status}`;
      throw resp.status === 404
        ? new IncorrectDataError(errorMessage)
        : new Error(errorMessage);
    }
    const respText = await resp.text();
    this.document = new JSDOM(respText).window.document;
    this.summary = this.document?.getElementById(
      `submissionRow${submissionID}`
    );
    const isNumeric = (str: string): boolean => {
      return str.trim() !== '' && !isNaN(Number(str.trim()));
    };
    this.testcases = Array.from(
      this.document?.querySelectorAll(
        `#submissionFeedback${this.submissionData.submissionID} tbody tr`
      )
    ).filter(
      tr =>
        tr.childNodes[0].textContent && isNumeric(tr.childNodes[0].textContent)
    );
  }
}

export class OjuzResultFetcher extends ResultFetcher {
  private summary: Element | null = null;
  private testCases?: string[][];
  private document?: Document;
  private statusText?: string;

  constructor(submissionData: SubmissionData) {
    super(submissionData);
  }
  async initialize(): Promise<void> {
    const { submissionID } = this.submissionData;

    const url = `https://oj.uz/submission/${submissionID}`;
    const resp = await fetch(url);
    if (resp.status !== 200) {
      const errorMessage = `Oj.uz: response status is not 200; url: ${url}; response status: ${resp.status}`;
      throw resp.status === 404
        ? new IncorrectDataError(errorMessage)
        : new Error(errorMessage);
    }
    const respText = await resp.text();
    this.document = new JSDOM(respText).window.document;
    this.summary = this.document.querySelector(
      'table.table-condensed > tbody > tr'
    );
    this.statusText = this.summary?.children[5]
      .querySelector('.progressbar > .text')
      ?.textContent?.toLowerCase();

    const subtaskCount = this.document.querySelectorAll(
      '#submission-panels .subtask-result-panel'
    ).length;

    this.testCases = [];
    for (let subtask = 0; subtask < subtaskCount; subtask++) {
      this.testCases.push(...(await this.fetchSubtaskInfo(subtask)));
    }
  }

  async fetchSubtaskInfo(subtask: number): Promise<string[][]> {
    const url = `https://oj.uz/submission/${this.submissionData.submissionID}/subtask-result/${subtask}`;

    const resp = await fetch(url);
    if (resp.status !== 200) {
      const errorMessage = `Oj.uz: subtask result response status is not 200; url: ${url}; response status: ${resp.status}`;
      throw resp.status === 404
        ? new IncorrectDataError(errorMessage)
        : new Error(errorMessage);
    }
    return await resp.json();
  }

  formatMemory(memory: string | null): string | null {
    const num = memory ? parseInt(memory?.split(' ')[0]) : NaN;
    return isNaN(num) ? null : Math.round(num / 100) / 10 + ' MB';
  }

  getLink(): string | null {
    return `https://oj.uz/submission/${this.submissionData.submissionID}`;
  }

  getMemory(): string | null {
    return this.formatMemory(this.summary?.children[7].textContent ?? null);
  }

  getMessage(): string {
    const scoreRegex = new RegExp('[0-9]+ / [0-9]+');
    if (this.statusText === 'compilation error') {
      return this.statusText;
    }
    if (!this.statusText || !scoreRegex.test(this.statusText)) {
      return 'running';
    }
    const tokens = this.statusText.split(' / ');
    if (tokens[0] == tokens[1]) {
      return 'correct answer';
    }
    if (tokens[0] !== '0') {
      return `[${tokens[0] + ' / ' + tokens[1]}] Partially correct`;
    }
    for (let i = 0; i < this.testCases!.length; i++) {
      if (this.getTestCaseTitle(i) !== 'correct answer') {
        return this.getTestCaseTitle(i);
      }
    }
    return '?';
  }

  getOutput(): string | null {
    if (this.statusText === 'compilation error') {
      return (
        this.document?.querySelector('#compilation_message')?.textContent ??
        null
      );
    }
    return null;
  }

  getStatusCode(): StatusCode {
    const scoreRegex = new RegExp('[0-9]+ / [0-9]+');
    if (
      !this.statusText ||
      (!scoreRegex.test(this.statusText) &&
        this.statusText !== 'compilation error')
    ) {
      return 'working';
    }
    return 'resolved';
  }

  getStatusText(): string | null {
    const scoreRegex = new RegExp('[0-9]+ / [0-9]+');
    if (
      !this.statusText ||
      (!scoreRegex.test(this.statusText) &&
        this.statusText !== 'compilation error')
    ) {
      return 'status-working';
    }
    return 'status-done';
  }

  getTime(): string | null {
    return this.summary?.children[6].textContent ?? null;
  }

  getTestCaseNum(): number {
    return this.testCases!.length;
  }

  getTestCaseTitle(n: number): string {
    const verdict = this.testCases![n][2].toLowerCase();
    if (verdict === 'correct') {
      return 'correct answer';
    }
    return verdict ?? '?';
  }
  getTestCaseSymbol(n: number): string {
    const verdict = this.getTestCaseTitle(n);
    return verdict === 'correct answer' ? '✓' : 'x';
  }
  getTestCaseTime(n: number): string | null {
    return this.testCases![n][3].toLowerCase();
  }
  getTestCaseMemory(n: number): string | null {
    const memory = this.testCases![n][4].toLowerCase();
    return this.formatMemory(memory);
  }
}

type PlanetsSubmission = {
  compiler_output: string;
  language: string;
  problem_id: string;
  solution: string;
  test_results: {
    checker_output: string;
    index: number;
    memory: string;
    output: string;
    time: number;
    verdict: string;
  }[];
  timestamp: Date;
  user_id: string;
  verdict: string;
};

export class PlanetsResultFetcher extends ResultFetcher {
  private resultData?: StatusData;

  constructor(submissionData: SubmissionData) {
    super(submissionData);
  }

  private mapVerdictToSymbol(verdict: string): string {
    if (verdict === 'Accepted') return '✓';
    if (verdict === 'Did not run') return '?';
    return 'x';
  }

  private mapVerdictToTitle(verdict: string): string {
    if (verdict === 'Accepted') return 'correct answer';
    if (verdict === 'Wrong answer') return 'incorrect answer';
    return verdict;
  }

  private mapVerdictToStatusCode(verdict: string): StatusCode {
    if (verdict.startsWith('Starting') || verdict.startsWith('Running'))
      return 'working';
    return 'resolved';
  }
  async initialize(): Promise<void> {
    const firestore = process.env.FUNCTIONS_EMULATOR
      ? getFirestore()
      : getFirestore('planets');
    const snapshot = await firestore
      .doc(`submissions/${this.submissionData.submissionID}`)
      .get();
    if (!snapshot.exists) {
      throw new IncorrectDataError('Planets: submission ID not found');
    }
    const parseMemory = (x: string) => parseInt(x.slice(0, x.length - 1));
    const result = snapshot.data()! as PlanetsSubmission;
    const statusCode = this.mapVerdictToStatusCode(result.verdict);
    const memory = Math.max(
      ...(result.test_results ?? []).map(t => parseMemory(t.memory))
    );
    const time = Math.max(...(result.test_results ?? []).map(t => t.time));
    const output = result.compiler_output;

    this.resultData = {
      link: null,
      memory: Number.isFinite(memory)
        ? Math.round(memory / 10000) / 100 + ' MB'
        : null,
      time: Number.isFinite(time) ? Math.round(time / 1000000) + ' ms' : null,
      statusText: statusCode === 'working' ? 'status-working' : 'status-done',
      message: this.mapVerdictToTitle(result.verdict),
      statusCode: statusCode,
      output: statusCode === 'resolved' ? (output ?? '') : '',
      testCases:
        result.test_results == undefined
          ? []
          : result.test_results.map(t => ({
              title: this.mapVerdictToTitle(t.verdict),
              trialNum: t.index,
              symbol: this.mapVerdictToSymbol(t.verdict),
              memory: Math.round(parseMemory(t.memory) / 10000) / 100 + ' MB',
              time: Math.round(t.time / 1000000) + ' ms',
            })),
    };
  }

  getTestCaseNum(): number {
    return this.resultData!.testCases!.length;
  }

  getTestCaseTitle(n: number): string {
    return this.resultData!.testCases![n].title;
  }
  getTestCaseSymbol(n: number): string {
    return this.resultData!.testCases![n].symbol;
  }
  getTestCaseTime(n: number): string | null {
    return this.resultData!.testCases![n].time;
  }
  getTestCaseMemory(n: number): string | null {
    return this.resultData!.testCases![n].memory;
  }

  getLink(): string | null {
    return this.resultData!.link;
  }

  getMemory(): string | null {
    return this.resultData!.memory;
  }

  getMessage(): string {
    return this.resultData!.message!;
  }

  getOutput(): string | null {
    return this.resultData!.output;
  }

  getStatusCode(): StatusCode {
    return this.resultData!.statusCode;
  }

  getStatusText(): string | null {
    return this.resultData!.statusText;
  }

  getTime(): string | null {
    return this.resultData!.time;
  }
}

export class SPOJResultFetcher extends ResultFetcher {
  private summary?: Element;
  private error?: Element;
  private readonly headers: HeadersInit;

  constructor(readonly submissionData: SubmissionData) {
    super(submissionData);
    this.headers = {
      Cookie: submissionData.sessionCookie ?? '',
    };
  }

  getLink(): string | null {
    const { problemID, username } = this.submissionData;
    return `https://www.spoj.com/status/${problemID},${username}/all`;
  }

  getMemory(): string | null {
    const memory = parseFloat(
      this.summary!.querySelector('td.smemory')
        ?.textContent?.trim()
        ?.slice(0, -1) ?? '?'
    );
    if (isNaN(memory)) {
      return null;
    }
    return memory + ' MB';
  }

  getTime(): string | null {
    const time = parseFloat(
      this.summary!.querySelector('td.stime')?.textContent?.trim() ?? '?'
    );
    if (isNaN(time)) {
      return null;
    }
    return Math.round(1000 * time) + ' ms';
  }

  getMessage(): string {
    const message =
      (
        this.summary!.querySelector('td.statusres > strong') ??
        this.summary!.querySelector('td.statusres > a') ??
        this.summary!.querySelector('td.statusres')
      )?.childNodes[0].textContent
        ?.toLowerCase()
        ?.trim() ?? '';

    if (message.startsWith('compiling') || message.startsWith('running')) {
      return 'running';
    }
    if (message === 'accepted') {
      return 'correct answer';
    }
    return message;
  }

  getOutput(): string | null {
    return this.error?.textContent ?? null;
  }

  getStatusCode(): StatusCode {
    const message = this.getMessage();
    if (message === 'running') {
      return 'working';
    }
    return 'resolved';
  }

  getStatusText(): string | null {
    const message = this.getMessage();
    if (message === 'running') {
      return 'status-working';
    }
    return 'status-done';
  }

  async initialize(): Promise<void> {
    const { submissionID, username, problemID } = this.submissionData;
    if (!username) {
      throw new IncorrectDataError('SPOJ: username is missing');
    }
    const fetchPage = async (page: number) => {
      const url = `https://www.spoj.com/status/${problemID},${username}/all/start=${page}`;
      const resp = await fetch(url, {
        headers: this.headers,
      });
      if (resp.status !== 200) {
        const errorMessage = `SPOJ: response status is not 200; url: ${url}; response status: ${resp.status}`;
        throw resp.status === 404
          ? new IncorrectDataError(errorMessage)
          : new Error(errorMessage);
      }
      return resp;
    };
    const getError = async () => {
      const resp = await fetch(`https://www.spoj.com/error/${submissionID}`, {
        headers: this.headers,
      });
      const respText = await resp.text();
      const document = new JSDOM(respText).window.document;
      return document.querySelector('pre > small') ?? undefined;
    };
    const getSummary = async (document: Document) => {
      const submissionIDs = Array.from(
        document.querySelectorAll('td.statustext:not([id])')
      ).map(element => element.textContent!.trim());
      const index = submissionIDs.findIndex(id => id === submissionID);
      if (index === -1) {
        throw new IncorrectDataError('SPOJ: submission ID not found');
      }
      const rows = Array.from(
        document.querySelector('table.problems > tbody')?.children ?? []
      );
      return rows[index];
    };
    const getTask = () => {
      return this.summary!.querySelector('td.sproblem > a')?.getAttribute(
        'title'
      );
    };
    let lastSubmissionIDs: string[] = [];

    for (let currPage = 0; ; currPage += 20) {
      const resp = await fetchPage(currPage);
      const respText = await resp.text();
      const document = new JSDOM(respText).window.document;
      const submissionIDs = Array.from(
        document.querySelectorAll('a.sourcelink.op_window')
      )
        .map(element => element.textContent!.trim().padStart(20, '0'))
        .sort();
      if (
        submissionIDs.length === 0 ||
        submissionIDs.toString() === lastSubmissionIDs.toString()
      ) {
        break;
      }
      const minID = submissionIDs[0];
      const maxID = submissionIDs.at(-1)!;
      const paddedSubmissionID = submissionID.padStart(20, '0');

      if (paddedSubmissionID >= minID && paddedSubmissionID <= maxID) {
        this.summary = await getSummary(document);
        break;
      }
      lastSubmissionIDs = submissionIDs;
    }
    this.error = await getError();

    if (!this.summary) {
      throw new IncorrectDataError('SPOJ: submission ID not found');
    }
    if (getTask() !== problemID) {
      throw new IncorrectDataError(
        `SPOJ: problem IDs don't match (${getTask()} - ${problemID})`
      );
    }
  }
}

type CFVerdict =
  | 'FAILED'
  | 'OK'
  | 'PARTIAL'
  | 'COMPILATION_ERROR'
  | 'RUNTIME_ERROR'
  | 'WRONG_ANSWER'
  | 'PRESENTATION_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'IDLENESS_LIMIT_EXCEEDED'
  | 'SECURITY_VIOLATED'
  | 'CRASHED'
  | 'INPUT_PREPARATION_CRASHED'
  | 'CHALLENGED'
  | 'SKIPPED'
  | 'TESTING'
  | 'REJECTED';

// https://codeforces.com/apiHelp/objects#Problem
type CFProblem = {
  contestId?: number;
  index: string;
};

// https://codeforces.com/apiHelp/objects#Submission
type CFSubmission = {
  id: number;
  contestId?: number;
  problem: CFProblem;
  verdict?: CFVerdict;
  passedTestCount: number;
  timeConsumedMillis: number;
  memoryConsumedBytes: number;
};

export class CFResultFetcher extends ResultFetcher {
  private submission?: CFSubmission;

  constructor(
    readonly submissionData: SubmissionData,
    private resultJSON: CFSubmission[]
  ) {
    super(submissionData);
  }

  getStatusText(): string {
    return this.submission!.verdict === 'TESTING'
      ? 'status-working'
      : 'status-done';
  }

  getStatusCode(): StatusCode {
    return this.submission!.verdict === 'TESTING' ? 'working' : 'resolved';
  }

  getMessage(): string {
    let formatted = this.submission!.verdict!.split('_')
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
      formatted += ` on test ${this.submission!.passedTestCount + 1}`;
    }
    return formatted;
  }

  getLink(): string {
    const { submissionID } = this.submissionData;
    return `https://codeforces.com/contest/${this.submission!.contestId}/submission/${submissionID}`;
  }

  getMemory(): string | null {
    return (
      Math.round(this.submission!.memoryConsumedBytes / 100000) / 10 + ' MB'
    );
  }

  getTime(): string | null {
    return this.submission!.timeConsumedMillis + ' ms';
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
      entry => '' + entry.id === submissionID
    );
    if (!this.submission) {
      throw new IncorrectDataError(
        `CF: no such submission (username: ${username}, submission ID: ${submissionID})`
      );
    }
    const respProblemID: string =
      '' +
      this.submission.problem!.contestId!.toString() +
      this.submission.problem.index;

    if (problemID !== respProblemID) {
      throw new IncorrectDataError(
        `CF: problem IDs don't match (${problemID} - ${respProblemID})`
      );
    }
    this.submission.verdict ??= 'TESTING';
  }
}

export class AtCoderResultFetcher extends ResultFetcher {
  private static codeToVerdict = {
    CE: 'compile error',
    AC: 'correct answer',
    WA: 'wrong answer',
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

  constructor(readonly submissionData: SubmissionData) {
    super(submissionData);
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
    if (this.getTask() !== problemID) {
      throw new IncorrectDataError(
        `AtCoder: problem IDs don't match (${this.getTask()} - ${problemID})`
      );
    }
  }
}

export class CSESResultFetcher extends ResultFetcher {
  private readonly headers: HeadersInit;
  private document?: Document;
  private summary?: Element;
  private testcases?: Element[];

  constructor(readonly submissionData: SubmissionData) {
    super(submissionData);
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
  params: { [key: string]: unknown }
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

  const getQueryStr = (params: { [key: string]: unknown }) => {
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
