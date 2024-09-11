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
  }
  return 'Unknown';
};
