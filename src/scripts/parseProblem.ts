import { Platform, URLProblem } from '../types/problem';

export const parseProblem = (url: string): URLProblem => {
  const platforms: {
    platform: Platform;
    regex: RegExp;
    process?: (id: string) => string;
  }[] = [
    {
      platform: 'codeforces',
      regex: /codeforces\.com\/problemset\/problem\/(\d+\/[A-Z]+[0-9]*)/,
      process: (id: string) => id.replace('/', ''),
    },
    {
      platform: 'codeforces',
      regex: /codeforces\.com\/contest\/(\d+\/problem\/[A-Z]+[0-9]*)/,
      process: (id: string) => id.replace('/problem/', ''),
    },
    {
      platform: 'atcoder',
      regex: /atcoder.jp\/contests\/[A-Za-z0-9]+\/tasks\/([A-Za-z0-9_]+)/,
    },
    { platform: 'cses', regex: /cses.fi\/problemset\/task\/([0-9]+)/ },
    { platform: 'spoj', regex: /spoj.com\/problems\/([A-Z0-9_]+)/ },
    {
      platform: 'planets',
      regex: /planets.algopro.hu\/taskoverview\/([0-9a-z_-]+)/,
    },
    { platform: 'ojuz', regex: /oj.uz\/problem\/view\/([A-Za-z0-9_]+)/ },
    {
      platform: 'njudge',
      regex: /njudge.hu\/problemset\/main\/([A-Za-z0-9_]+)\//,
    },
  ];

  for (const { platform, regex, process } of platforms) {
    const match = url.match(regex);
    if (match) {
      return {
        title: null,
        url,
        platform: platform,
        id: process ? process(match[1]) : match[1],
      };
    }
  }

  return { title: null, url, id: null, platform: null };
};
