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

export type Language = 'cpp' | 'py' | 'java';

export type Hint = string | Partial<Record<Language, string>>;

export type ProblemTag = string;
export const problemTags: ProblemTag[] = [
  '2-sat',
  'binary search',
  'bitmasks',
  'brute force',
  'chinese remainder theorem',
  'combinatorics',
  'constructive algorithms',
  'data structures',
  'dfs and similar',
  'divide and conquer',
  'dp',
  'dsu',
  'expression parsing',
  'fft',
  'flows',
  'games',
  'geometry',
  'graph matchings',
  'graphs',
  'greedy',
  'hashing',
  'implementation',
  'interactive',
  'math',
  'matrices',
  'meet-in-the-middle',
  'number theory',
  'probabilities',
  'schedules',
  'shortest paths',
  'sortings',
  'string suffix structures',
  'strings',
  'ternary search',
  'trees',
  'two pointers',
];

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
  hints?: Hint[];
  topicID?: string;
};

export type ProblemSolution = {
  problemID: string;
  platform: Platform;
  sourceCode: string;
  language: Language;
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
  hints: Hint[];
};
