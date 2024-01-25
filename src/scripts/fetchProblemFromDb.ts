import { getFirestore, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { PlatformProblem, ProblemData } from '../types/problem';

export async function fetchProblemFromDb(
  problem: PlatformProblem | null
): Promise<ProblemData | undefined> {
  if (!problem) return undefined;

  const docRef = doc(
    getFirestore(),
    'problemsets',
    problem.platform,
    'problems',
    problem.problemID
  );

  return (await getDoc(docRef)).data() as ProblemData | undefined;
}
