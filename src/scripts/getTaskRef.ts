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
