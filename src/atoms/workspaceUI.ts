import { atom } from 'jotai';
import { ProblemData } from '../components/Workspace/Workspace';

export const mobileActiveTabAtom = atom<'code' | 'io' | 'users'>('code');
export const showSidebarAtom = atom<boolean>(false);
export const inputTabAtom = atom<string>('input');
export const problemAtom = atom<ProblemData | null | undefined>(undefined);
export const tabsListAtom = atom(get => {
  const problem = get(problemAtom);
  return [
    { label: 'Input', value: 'input' },
    ...(problem ? [{ label: 'Task Overview', value: 'judge' }] : []),
    ...(problem ? [{ label: 'Results', value: 'results' }] : []),
  ];
});
export const inputTabIndexAtom = atom(get => {
  const inputTab = get(inputTabAtom);
  const tabsList = get(tabsListAtom);
  let res = 0;
  while (res < tabsList.length && tabsList[res].value !== inputTab) ++res;
  return res;
});

// // https://github.com/pmndrs/jotai#derived-async-atoms-
// // https://docs.pmnd.rs/jotai/basics/async#suspense
// // eslint-disable-next-line @typescript-eslint/no-unused-vars
// export const allProblemDataAtom = atom(async get => {
//   const response = await fetch(`${judgePrefix}/problems`);
//   const json: Record<string, ProblemData> = await response.json();
//   return json;
// });
