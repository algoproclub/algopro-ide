export type PlatformProblem = {
  platform: Platform;
  id: string;
};

export type URLProblem = {
  id: string | null;
  title: string | null;
  url: string;
  platform: Platform | null;
};

export type TagProblem = {
  id: string | null;
  title: string | null;
  url: string;
  platform: Platform | null;
  tags: ProblemTag[] | null;
};

export const platforms = [
  'codeforces',
  'cses',
  'atcoder',
  'spoj',
  'usaco',
  'planets',
  'ojuz',
  'njudge',
] as const;

export type Platform = (typeof platforms)[number];

export type Language = 'cpp' | 'py' | 'java';

export type Hint = string | Partial<Record<Language, string>>;

export type ProblemTag = string;
export const problemTags: ProblemTag[] = [
  '2-sat',
  '2d array',
  'ad hoc',
  'backtracking',
  'bellman-ford',
  'bfs',
  'binary search',
  'bitmask dp',
  'bitmasks',
  'bitset',
  'bitwise operations',
  'bridges and articulation points',
  'brute force',
  'class',
  'combinatorics',
  'constructive',
  'coordinate compression',
  'count',
  'crt',
  'dag',
  'dfs',
  'dijkstra',
  'divide and conquer',
  'dp',
  'dp optimization',
  'dsu',
  'euler',
  'fenwick tree',
  'fft',
  'floyd-warshall',
  'flows',
  'for loop',
  'function',
  'games',
  'gaussian elimination',
  'geometry',
  'graph matchings',
  'graphs',
  'greedy',
  'hashing',
  'heap',
  'histogram',
  'if',
  'implementation',
  'inclusion-exclusion',
  'interactive',
  'kmp and z-function',
  'knapsack',
  'lca',
  'lcs',
  'lis',
  'map',
  'math',
  'matrices',
  'maximum selection',
  'meet-in-the-middle',
  'modular inverse',
  'monoton deque',
  'monoton stack',
  'mst',
  'number theory',
  'path dp',
  'permutations',
  'prefix sums',
  'priority queue',
  'probabilities',
  'queue',
  'range dp',
  'recursion',
  'scc',
  'search',
  'segment tree',
  'set',
  'shortest paths',
  'sliding window',
  'sorting',
  'sparse table',
  'sqrt decomposition',
  'string suffix structures',
  'strings',
  'sum',
  'ternary search',
  'trees',
  'trie',
  'two pointers',
  'vector',
  'while loop',
];

export type ProblemData = {
  id: string;
  submittable: boolean;
  platform: Platform;
  url: string;
  source: string;
  title: string;
  statement: string | null;
  statementURL?: string;
  input: string;
  output: string;
  templateCode: Partial<Record<Language, string>> | null;
  timeLimit?: string;
  memoryLimit?: string;
  samples: Sample[];
  hints?: Hint[];
  topicID?: string;
};

export type ProblemSolution = {
  fileID: string;
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
  hints: Hint[];
} & ({ statement: string } | { statementURL: string });
