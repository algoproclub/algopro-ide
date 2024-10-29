import { NextApiRequest, NextApiResponse } from 'next';
import { PlatformProblem } from '../../src/types/problem';
import { Platform } from '../../src/types/problem';
import { getDatabase } from 'firebase-admin/database';
import firebaseApp from '../../src/firebaseAdmin';

type TournamentInfo = {
  platform: Platform;
  problemID: string;
  start: string;
};

type ResponseData =
  | { start: string }
  | (PlatformProblem & { tournamentID: string })
  | { error: string };

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) => {
  const tournamentID = (
    await getDatabase(firebaseApp).ref('tournaments/latestID').get()
  ).val();

  if (!tournamentID) {
    res.status(404).json({ error: 'No tournament available' });
    return;
  }

  const tournamentRef = await getDatabase(firebaseApp)
    .ref(`tournaments/${tournamentID}/info`)
    .get();

  const tournament = tournamentRef.val() as TournamentInfo;

  const available = new Date() >= new Date(tournament.start);

  if (available) {
    res.status(200).json({
      platform: tournament.platform,
      id: tournament.problemID,
      tournamentID,
    });
  }

  res.status(200).json({ start: tournament.start });
};
