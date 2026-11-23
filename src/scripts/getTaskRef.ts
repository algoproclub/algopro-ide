import type { Platform } from '../types/problem';

export type ClassContext = {
  group: string;
  class: string;
};

export const getClassContext = (
  group: unknown,
  groupClass: unknown
): ClassContext | null =>
  typeof group === 'string' && typeof groupClass === 'string'
    ? { group, class: groupClass }
    : null;

export const parseFileID = (value: string): string | null => {
  const input = value.trim();
  if (/^[A-Za-z0-9_-]+$/.test(input)) {
    // File URLs omit the leading hyphen of the 20-character Firebase push ID.
    return input.length === 20 && input.startsWith('-')
      ? input.slice(1)
      : input;
  }
  try {
    const base = new URL(process.env.NEXT_PUBLIC_BASE_URL!);
    const url = new URL(input, base);
    if (url.origin !== base.origin) return null;
    return /^\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
};

export const getTaskRef = (
  target: { id: string } | { platform: Platform; problemID: string },
  classContext?: ClassContext
) => ({
  pathname: 'id' in target ? '/[id]' : '/solve/[platform]/[id]',
  query: {
    ...classContext,
    ...('id' in target
      ? { id: target.id }
      : { platform: target.platform, id: target.problemID }),
  },
});
