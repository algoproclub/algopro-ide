export type Platform = 'codeforces' | 'cses' | 'atcoder' | 'usaco' | 'planets';

export type ProblemData = {
  id: string;
  submittable: boolean;
  platform: Platform;
  url: string;
  source: string;
  title: string;
  input: string;
  output: string;
  samples: Sample[];
};

export interface Sample {
  input: string;
  output: string;
}

export type FileSubmission = {
  id: string;
  username: string | null;
};

export interface StatusData {
  statusCode: number;
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
