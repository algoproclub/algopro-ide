// Central place for platform-specific regexes and URL builders

export const CODEFORCES_PROBLEM_REGEX = /^(\d+)([A-Z].*)$/;
export const CODEFORCES_TITLE_REGEX = /\w+\. (.*)/;

export const ATCODER_PROBLEM_REGEX = /(\w+)_(\w+)/;

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
