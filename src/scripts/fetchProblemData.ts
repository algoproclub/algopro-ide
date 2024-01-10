import { Platform, ProblemData } from '../context/EditorContext';
import { judgePrefix } from '../components/JudgeInterface/PlanetsJudgeInterface';

export async function fetchProblemData(
  problemID: string,
  platform: Platform = 'USACO'
): Promise<ProblemData | null> {
  const url = `${judgePrefix}/problem/${problemID}`;
  const response = await fetch(url);
  if (response.status !== 200) return null;

  return (async function (): Promise<ProblemData | null> {
    const res = await response.json();
    res.platform = platform;
    if (platform == 'CF') {
      res.source += 'LOLzzz'; // just for testing, replace this entire thing with something meaningful
    }
    return res;
  })();
}
