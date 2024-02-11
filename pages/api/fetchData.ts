import { PlatformProblem, ProblemData } from '../../src/types/problem';
import { fetchProblemData } from '../../src/scripts/fetchProblemData';
import { NextApiRequest, NextApiResponse } from 'next';

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ProblemData>
) => {
  const data: PlatformProblem = req.body;
  const resp = await fetchProblemData(data);
  if (!resp) {
    res.status(400);
    return;
  }
  res.status(200).json(resp);
};
