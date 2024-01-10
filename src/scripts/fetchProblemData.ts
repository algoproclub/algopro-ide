import { Platform, ProblemData } from '../context/EditorContext';
import { judgePrefix } from '../components/JudgeInterface/PlanetsJudgeInterface';

export async function fetchProblemData(
  problemID: string,
  platform: Platform = 'USACO'
): Promise<ProblemData | null> {
  //TODO do something depending on the platform
  const url = `${judgePrefix}/problem/${problemID}`;
  const response = await fetch(url);
  if (response.status !== 200) return null;

  const res = await response.json();
  res.platform = platform;
  return res;
}
