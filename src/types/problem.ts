import { Sample } from './judge';

export type PlatformProblem = {
  platform: Platform;
  problemID: string;
};

export enum Platform {
  CF = 'CF',
  CSES = 'CSES',
  ATCODER = 'AtCoder',
  USACO = 'USACO',
}

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
  samples: Sample[];
};
