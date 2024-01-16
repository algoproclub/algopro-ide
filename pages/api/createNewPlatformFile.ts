import { Platform } from '../../src/types/problem';
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchProblemData } from '../../src/scripts/fetchProblemData';
import { getDatabase, ServerValue } from 'firebase-admin/database';
import firebaseApp from '../../src/firebaseAdmin';
import colorFromUserId from '../../src/scripts/colorFromUserId';

type RequestData = {
  platform: Platform;
  problemID: string;
  userID: string;
  userName: string;
  defaultPermission: string;
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
    !data.platform
  ) {
    res.status(400).json({
      message: 'Bad data',
    });
    return;
  }

  let problem = (
    await fetchProblemData({
      problemID: data.problemID,
      platform: data.platform,
    })
  ).data;
  if (problem === null) {
    res.status(400).json({
      message: 'Could not identify problem ID.',
    });
    return;
  }
  problem.id = problem.id.toString();

  const idToURLRef = getDatabase(firebaseApp)
    .ref('users')
    .child(data.userID)
    .child('platform-' + data.platform)
    .child('problem-id-to-file-id')
    .child('' + problem.id);

  const idToURLSnap = await idToURLRef.get();

  if (idToURLSnap.exists()) {
    res.status(200).json({
      fileID: idToURLSnap.val(),
    });
  } else {
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
        settings: {
          workspaceName: problem.source + ': ' + problem.title,
          defaultPermission: data.defaultPermission,
          creationTime: ServerValue.TIMESTAMP,
          language: 'cpp', //TODO think about how do we support other languages with this method?
          problem,
          compilerOptions: {
            cpp: '-std=c++17 -O2 -Wall -Wextra -Wshadow -Wconversion -Wfloat-equal -Wduplicated-cond -Wlogical-op',
            java: '',
            py: '',
          },
        },
      });
    const fileID: string = resp.key!;
    await idToURLRef.set(fileID);

    res.status(200).json({ fileID: fileID });
  }
};
