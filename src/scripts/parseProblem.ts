import { PlatformProblem, URLProblem } from '../types/problem';

export const parseProblem = (url: string): URLProblem => {
  const rCodeforces1 =
    /codeforces\.com\/problemset\/problem\/(\d+\/[A-Z]+[0-9]*)/;
  const rCodeforces2 = /codeforces\.com\/contest\/(\d+\/problem\/[A-Z]+[0-9]*)/;
  const rAtCoder = /atcoder.jp\/contests\/[A-Za-z0-9]+\/tasks\/([A-Za-z0-9_]+)/;
  const rCSES = /cses.fi\/problemset\/task\/([0-9]+)/;
  const rSPOJ = /spoj.com\/problems\/([A-Z0-9]+)/;
  const rPlanets = /planets.algopro.hu\/taskoverview\/([0-9a-z_-]+)/;

  let platformProblem: PlatformProblem | null = null;
  if (rCodeforces1.test(url)) {
    platformProblem = {
      platform: 'codeforces',
      id: url.match(rCodeforces1)!.at(1)!.replace('/', ''),
    };
  }
  if (rCodeforces2.test(url)) {
    platformProblem = {
      platform: 'codeforces',
      id: url.match(rCodeforces2)!.at(1)!.replace('/problem/', ''),
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
  if (rPlanets.test(url)) {
    platformProblem = {
      platform: 'planets',
      id: url.match(rPlanets)!.at(1)!,
    };
  }
  if (!platformProblem) {
    return { title: null, url, id: null, platform: null };
  } else {
    return { title: null, url, ...platformProblem };
  }
};
