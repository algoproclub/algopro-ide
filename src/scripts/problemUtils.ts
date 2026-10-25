// Central place for platform-specific regexes and URL builders
import type { Platform } from '../types/problem';

export const CODEFORCES_PROBLEM_REGEX = /^(\d+)([A-Z].*)$/;
export const CODEFORCES_TITLE_REGEX = /\w+\. (.*)/;

export const ATCODER_PROBLEM_REGEX = /(\w+)_(\w+)/;

type SubmissionMode = 'manual' | 'automatic';

const platformSubmissionSupport: Record<Platform, SubmissionMode | 'both'> = {
  // Automatic submission is temporarily disabled for Codeforces and AtCoder until we manage to fix it.
  codeforces: 'manual',
  atcoder: 'manual',

  // Planets problems can only be submitted through the IDE.
  planets: 'automatic',

  // The backend can only fetch results of submissions made by ourselves.
  cses: 'automatic',

  ojuz: 'both',
  spoj: 'both',
  njudge: 'both',
  yosupo: 'both',

  // Not used
  usaco: 'both',
};

export function getSubmissionMode(
  platform: Platform,
  preferManual: boolean
): SubmissionMode {
  const support = platformSubmissionSupport[platform];
  if (support !== 'both') return support;
  return preferManual ? 'manual' : 'automatic';
}

// ---- URL builders ----

export function buildCodeforcesUrl(problemID: string): string | null {
  let isGym = false;
  if (problemID.startsWith('gym')) {
    isGym = true;
    problemID = problemID.slice(3);
  }
  const matches = problemID.match(CODEFORCES_PROBLEM_REGEX);
  if (!matches) {
    return null;
  }
  return `https://codeforces.com/${isGym ? 'gym' : 'contest'}/${matches[1]}/problem/${matches[2]}`;
}

export function buildAtCoderUrl(problemID: string): string | null {
  const matches = problemID.match(ATCODER_PROBLEM_REGEX);
  if (!matches) {
    return null;
  }
  return `https://atcoder.jp/contests/${matches[1]}/tasks/${problemID}`;
}

export function buildCsesUrl(problemID: string) {
  return `https://cses.fi/problemset/task/${problemID}`;
}

export function buildSpojUrl(problemID: string) {
  return `https://spoj.com/problems/${problemID}`;
}

export function buildPlanetsUrl(problemID: string) {
  return `https://planets.algopro.hu/taskoverview/${problemID}`;
}

export function buildOjuzUrl(problemID: string) {
  return `https://oj.uz/problem/view/${problemID}`;
}

export function buildNjudgeUrl(problemID: string) {
  return `https://njudge.hu/problemset/main/${problemID}/`;
}

export function buildYosupoUrl(problemID: string) {
  return `https://judge.yosupo.jp/problem/${problemID}`;
}

export function buildProblemUrl(
  platform: Platform,
  problemID: string
): string | null {
  switch (platform) {
    case 'codeforces':
      return buildCodeforcesUrl(problemID);
    case 'atcoder':
      return buildAtCoderUrl(problemID);
    case 'cses':
      return buildCsesUrl(problemID);
    case 'spoj':
      return buildSpojUrl(problemID);
    case 'planets':
      return buildPlanetsUrl(problemID);
    case 'ojuz':
      return buildOjuzUrl(problemID);
    case 'njudge':
      return buildNjudgeUrl(problemID);
    case 'yosupo':
      return buildYosupoUrl(problemID);
    default:
      return null;
  }
}

// Page where a solution for the problem can be submitted manually.
export function buildSubmitUrl(
  platform: Platform,
  problemID: string
): string | null {
  switch (platform) {
    case 'codeforces':
      return `https://codeforces.com/problemset/submit?submittedProblemCode=${problemID.replace(/^gym/, '')}`;
    case 'atcoder':
      return buildAtCoderUrl(problemID);
    case 'spoj':
      return buildSpojUrl(problemID);
    case 'ojuz':
      return buildOjuzUrl(problemID);
    case 'njudge':
      return buildNjudgeUrl(problemID);
    case 'yosupo':
      return buildYosupoUrl(problemID);
    default:
      return null;
  }
}
