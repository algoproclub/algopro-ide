import { PlatformProblem, URLProblem } from '../types/problem';

export const parseProblem = (url: string): URLProblem => {
  const rCodeforces =
    /codeforces\.com\/problemset\/problem\/(\d+\/[A-Z]+[0-9]*)/;
  const rAtCoder = /atcoder.jp\/contests\/[A-Za-z0-9]+\/tasks\/([A-Za-z0-9_]+)/;
  const rCSES = /cses.fi\/problemset\/task\/([0-9]+)/;
  const rSPOJ = /spoj.com\/problems\/([A-Z0-9]+)/;

  let platformProblem: PlatformProblem | null = null;
  if (rCodeforces.test(url)) {
    platformProblem = {
      platform: 'codeforces',
      id: url.match(rCodeforces)!.at(1)!.replace('/', ''),
    };
  }
  if (rAtCoder.test(url)) {
    platformProblem = {
      platform: 'atcoder',
      id: url.match(rAtCoder)!.at(1)!,
    };
  }
  if (rCSES.test(url)) {
    platformProblem = {
      platform: 'cses',
      id: url.match(rCSES)!.at(1)!,
    };
  }
  if (rSPOJ.test(url)) {
    platformProblem = {
      platform: 'spoj',
      id: url.match(rSPOJ)!.at(1)!,
    };
  }
  if (!platformProblem) {
    return { url, id: null, platform: null };
  } else {
    return { url, ...platformProblem };
  }
};
