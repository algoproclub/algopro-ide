import { judgePrefix } from '../components/JudgeInterface/PlanetsJudgeInterface';
import { Platform, ProblemData } from '../types/problem';

export async function fetchProblemData(
  problemID: string,
  platform: Platform = 'usaco'
): Promise<ProblemData | null> {
  // TODO Dani fetch from Firebase
  const url = `${judgePrefix}/problem/${problemID}`;
  const response = await fetch(url);
  if (response.status !== 200) return null;

  return (async function (): Promise<ProblemData | null> {
    const res = await response.json();
    res.platform = platform;
    if (platform == 'codeforces') {
      res.source += 'LOLzzz'; // just for testing, replace this entire thing with something meaningful
    }
    return res;
  })();
}
