import { PlatformProblem, ProblemData } from '../../src/types/problem';
import { fetchProblemData } from '../../src/scripts/fetchProblemData';
import { fetchProblemTestcases } from '../../src/scripts/fetchProblemTestcases';
import { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseApp from '../../src/firebaseAdmin';

export const fetchData = async (data: PlatformProblem) => {
  await fetchProblemTestcases(data);

  const problemRef = getFirestore(firebaseApp)
    .collection('problemsets')
    .doc(data.platform)
    .collection('problems')
    .doc(data.id);

  let problem: ProblemData | null = null;
  const problemSnap = await problemRef.get();

  if (!problemSnap.exists) {
    problem = await fetchProblemData({
      id: data.id,
      platform: data.platform,
    });
    if (problem) {
      await problemRef.set(problem);
    }
  } else {
    problem = problemSnap.data()! as ProblemData;
  }
  return problem;
};

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ProblemData | null>
) => {
  const data: PlatformProblem = req.body;
  res.status(200).json(await fetchData(data));
};
