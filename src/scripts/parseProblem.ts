import { Platform, URLProblem } from '../types/problem';
import {
  buildCodeforcesUrl,
  buildAtCoderUrl,
  buildCsesUrl,
  buildSpojUrl,
  buildPlanetsUrl,
  buildOjuzUrl,
  buildNjudgeUrl,
} from './problemUtils';

const IDE_HOST = new URL(process.env.NEXT_PUBLIC_BASE_URL!).host;

export const parseProblem = (url: string): URLProblem => {
  // First, handle IDE solve links.

  let parsedURL: URL | undefined = undefined;
  try {
    parsedURL = new URL(url);
  } catch (e) {
    // ignored
  }
  const ideMatch =
    parsedURL?.host === IDE_HOST && url.match(/\/solve\/([^/]+)\/([^/]+)/);

  if (ideMatch) {
    const platform = ideMatch[1] as Platform;
    const id = ideMatch[2];

    let constructedUrl: string;
    switch (platform) {
      case 'planets':
        constructedUrl = buildPlanetsUrl(id);
        break;
      case 'cses':
        constructedUrl = buildCsesUrl(id);
        break;
      case 'spoj':
        constructedUrl = buildSpojUrl(id);
        break;
      case 'ojuz':
        constructedUrl = buildOjuzUrl(id);
        break;
      case 'njudge':
        constructedUrl = buildNjudgeUrl(id);
        break;
      case 'codeforces':
        constructedUrl = buildCodeforcesUrl(id) ?? url;
        break;
      case 'atcoder':
        constructedUrl = buildAtCoderUrl(id) ?? url;
        break;
      default:
        constructedUrl = url;
    }

    return {
      title: null,
      url: constructedUrl,
      platform,
      id,
    };
  }

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
      platform: 'codeforces',
      regex: /codeforces\.com\/gym\/(\d+\/problem\/[A-Z]+[0-9]*)/,
      process: (id: string) => 'gym' + id.replace('/problem/', ''),
    },
    {
      platform: 'atcoder',
      regex: /atcoder.jp\/contests\/[A-Za-z0-9]+\/tasks\/([A-Za-z0-9_]+)/,
    },
    { platform: 'cses', regex: /cses.fi\/problemset\/task\/([0-9]+)/ },
    { platform: 'spoj', regex: /spoj.com\/problems\/([A-Z0-9_]+)/ },
    {
      platform: 'yosupo',
      regex: /judge\.yosupo\.jp\/problem\/([A-Za-z0-9_]+)/,
    },
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
