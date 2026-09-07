import { atom } from 'jotai';
import { ProblemData, StatusData, Translation } from '../types/problem';

export const mobileActiveTabAtom = atom<'code' | 'io' | 'users'>('code');
export const showSidebarAtom = atom<boolean>(false);
export const inputTabAtom = atom<string>('input');
export const problemAtom = atom<ProblemData | undefined | null>(undefined);
export const statusDataAtom = atom<StatusData | null>(null);
export const statusDataHistoryAtom = atom<StatusData[] | null>([]);
export const solvedAtom = atom<boolean>(false);
export const translationsAtom = atom<Record<string, Translation>>({});
export const solutionsAtom = atom<Record<string, string>>({});
export const languageAtom = atom<string>('en');

// // https://github.com/pmndrs/jotai#derived-async-atoms-
// // https://docs.pmnd.rs/jotai/basics/async#suspense
// // eslint-disable-next-line @typescript-eslint/no-unused-vars
// export const allProblemDataAtom = atom(async get => {
//   const response = await fetch(`${judgePrefix}/problems`);
//   const json: Record<string, ProblemData> = await response.json();
//   return json;
// });
