import { getFirestore, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { PlatformProblem, ProblemData } from '../types/problem';

export async function fetchProblemFromDb(
  problem: PlatformProblem
): Promise<ProblemData | undefined> {
  const docRef = doc(
    getFirestore(),
    'problemsets',
    problem.platform,
    'problems',
    problem.id
  );

  return (await getDoc(docRef)).data() as ProblemData | undefined;
}
