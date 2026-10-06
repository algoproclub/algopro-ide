import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseApp from '../../src/firebaseAdmin';
import { parseProblemDataFromHtml } from '../../src/scripts/fetchProblemData';
import { Platform, platforms, ProblemData } from '../../src/types/problem';

type RequestData = {
  platform: Platform;
  id: string;
  html: string;
};

type ResponseData = ProblemData | { message: string };

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) => {
  const data: RequestData = req.body;

  if (
    !data ||
    !platforms.includes(data.platform) ||
    !data.id ||
    !data.html?.trim()
  ) {
    res.status(400).json({ message: 'Bad data' });
    return;
  }

  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    res
      .status(401)
      .json({ message: 'Missing or invalid Authorization header.' });
    return;
  }

  let caller;
  try {
    caller = await getAuth(firebaseApp).verifyIdToken(token);
  } catch {
    res.status(401).json({ message: 'Invalid Firebase authentication token.' });
    return;
  }

  const isTeacherOrAdmin =
    caller.admin === true ||
    (Array.isArray(caller.teacher) && caller.teacher.length > 0);
  if (!isTeacherOrAdmin) {
    res.status(403).json({ message: 'Teachers or admins only.' });
    return;
  }

  const problem = await parseProblemDataFromHtml({
    platform: data.platform,
    id: data.id,
    html: data.html,
  });

  if (!problem) {
    res.status(400).json({
      message: 'Could not find a problem statement in the pasted HTML.',
    });
    return;
  }

  await getFirestore(firebaseApp)
    .collection('problemsets')
    .doc(data.platform)
    .collection('problems')
    .doc(data.id)
    .set(problem);

  res.status(200).json(problem);
};
