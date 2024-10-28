import { Platform, ProblemData } from '../../src/types/problem';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase, ServerValue } from 'firebase-admin/database';
import firebaseApp from '../../src/firebaseAdmin';
import colorFromUserId from '../../src/scripts/colorFromUserId';
import { Language } from '../../src/context/UserContext';
import { fetchData } from './fetchProblemData';

type RequestData = {
  platform: Platform;
  problemID: string;
  userID: string;
  userName: string;
  defaultPermission: string;
  language: Language;
  tournamentID?: string;
};

type ResponseData =
  | {
      fileID: string;
    }
  | {
      message: string; // error
    };

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) => {
  const data: RequestData = req.body;

  if (
    !data ||
    !data.userName ||
    !data.defaultPermission ||
    !data.userID ||
    !data.problemID ||
    !data.platform ||
    !data.language
  ) {
    res.status(400).json({
      message: 'Bad data',
    });
    return;
  }

  // XXX: Normalize (lowercase, etc.) problem ID?
  const idToURLRef = data.tournamentID
    ? getDatabase(firebaseApp)
        .ref('users')
        .child(data.userID)
        .child('tournaments')
        .child('tournament-id-to-file-id')
        .child(data.tournamentID.toString())
    : getDatabase(firebaseApp)
        .ref('users')
        .child(data.userID)
        .child('platform-' + data.platform)
        .child('problem-id-to-file-id')
        .child(data.problemID);

  const idToURLSnap = await idToURLRef.get();

  if (idToURLSnap.exists()) {
    res.status(200).json({
      fileID: idToURLSnap.val(),
    });
    return;
  }
  const problem: ProblemData | null = await fetchData({
    platform: data.platform,
    id: data.problemID,
  });
  if (problem === null) {
    res.status(400).json({
      message: 'Could not fetch problem data.',
    });
    return;
  }
  const resp = await getDatabase(firebaseApp)
    .ref('/files')
    .push({
      users: {
        [data.userID]: {
          name: data.userName,
          color: colorFromUserId(data.userID),
          permission: 'OWNER',
        },
      },
      problem: { platform: data.platform, id: data.problemID },
      ...(data.tournamentID ? { tournamentID: data.tournamentID } : {}),
      settings: {
        workspaceName: problem.source + ': ' + problem.title,
        defaultPermission: data.defaultPermission,
        creationTime: ServerValue.TIMESTAMP,
        language: data.language, //TODO think about how do we support other languages with this method?
        compilerOptions: {
          cpp: '-std=c++17 -O2 -Wall -Wextra -Wshadow -Wconversion -Wfloat-equal -Wduplicated-cond -Wlogical-op',
          java: '',
          py: '',
        },
      },
    });
  const fileID: string = resp.key!;
  await idToURLRef.set(fileID);

  if (data.tournamentID) {
    await getDatabase(firebaseApp)
      .ref('tournaments')
      .child(data.tournamentID)
      .child('participants')
      .child(data.userID)
      .set({
        message: 'unsubmitted',
        statusCode: 'unsubmitted',
        fileID,
        submissionTime: null,
      });
  }

  res.status(200).json({ fileID: fileID });
};
