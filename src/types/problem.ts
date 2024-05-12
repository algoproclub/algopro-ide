export type PlatformProblem = {
  platform: Platform;
  id: string;
};

export type URLProblem = {
  id: string | null;
  url: string;
  platform: Platform | null;
};

export type Platform =
  | 'codeforces'
  | 'cses'
  | 'atcoder'
  | 'spoj'
  | 'usaco'
  | 'planets';

export type ProblemData = {
  id: string;
  submittable: boolean;
  platform: Platform;
  url: string;
  source: string;
  title: string;
  statement: string | null;
  input: string;
  output: string;
  timeLimit?: string;
  memoryLimit?: string;
  samples: Sample[];
  hints?: string[];
};

export type ProblemSolution = {
  problemID: string;
  platform: Platform;
  sourceCode: string;
  language: 'cpp' | 'java' | 'py';
};

export type SubmissionData = {
  id: string;
  username: string | null;
  platform: Platform;
};

export interface Sample {
  input: string;
  output: string;
}

export type FileSubmission = {
  id: string;
  username: string | null;
};

export type StatusCode = 'starting' | 'working' | 'error' | 'resolved';

export interface StatusData {
  statusCode: StatusCode;
  statusText: string | null;
  message: string | null;
  testCases: TestCase[] | null;
  output: string | null;
  memory: string | null;
  time: string | null;
  link: string | null;
}

export interface TestCase {
  title: string;
  trialNum: number;
  symbol: string;
  memory: string | null;
  time: string | null;
}

export type Translation = {
  statement: string;
  hints: string[];
};
