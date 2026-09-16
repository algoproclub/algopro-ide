import { Platform } from '../types/problem';

export const getPlatformName = (platform: Platform) => {
  switch (platform) {
    case 'codeforces':
      return 'Codeforces';
    case 'atcoder':
      return 'AtCoder';
    case 'cses':
      return 'CSES';
    case 'spoj':
      return 'SPOJ';
    case 'planets':
      return 'Planets';
    case 'ojuz':
      return 'OJUZ';
    case 'njudge':
      return 'NJudge';
    case 'usaco':
      return 'USACO';
  }
  return 'Unknown';
};
