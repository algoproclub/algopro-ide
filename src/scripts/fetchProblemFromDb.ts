import {
  getFirestore,
  getDoc,
  getDocs,
  getCountFromServer,
  doc,
  collection,
} from 'firebase/firestore';
import { PlatformProblem, ProblemData, Translation } from '../types/problem';

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

export async function fetchTranslationsFromDb(
  problem: PlatformProblem
): Promise<Record<string, Translation>> {
  const collectionRef = collection(
    getFirestore(),
    'problemsets',
    problem.platform,
    'problems',
    problem.id,
    'translations'
  );

  return Object.fromEntries(
    (await getDocs(collectionRef)).docs.map(doc => [
      doc.id,
      doc.data() as Translation,
    ])
  );
}

export async function fetchSolutionsFromDb(
  problem: PlatformProblem
): Promise<Record<string, string>> {
  const collectionRef = collection(
    getFirestore(),
    'problemsets',
    problem.platform,
    'problems',
    problem.id,
    'solutions'
  );

  return Object.fromEntries(
    (await getDocs(collectionRef)).docs
      .filter(doc => doc.data().content !== '')
      .map(doc => [doc.id, doc.data().content as string])
  );
}

export async function fetchSolutionsCountFromDb(
  problem: PlatformProblem
): Promise<number> {
  const collectionRef = collection(
    getFirestore(),
    'problemsets',
    problem.platform,
    'problems',
    problem.id,
    'solutions'
  );

  const snapshot = await getCountFromServer(collectionRef);
  return snapshot.data().count;
}
