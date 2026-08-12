import { Platform, ProblemData } from '../../src/types/problem';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase, ServerValue } from 'firebase-admin/database';
import firebaseApp from '../../src/firebaseAdmin';
import colorFromUserId from '../../src/scripts/colorFromUserId';
import { Language } from '../../src/context/UserContext';
import { fetchData } from './fetchProblemData';
import { DEFAULT_COMPILER_OPTIONS } from '../new';

type RequestData = {
  platform: Platform;
  problemID: string;
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

const FILE_INIT_WAIT_ATTEMPTS = 80;
const FILE_INIT_WAIT_DELAY_MS = 250;

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) => {
  const data: RequestData = req.body;
  const db = getDatabase(firebaseApp);
  const auth = getAuth(firebaseApp);

  if (
    !data ||
    !data.defaultPermission ||
    !data.problemID ||
    !data.platform ||
    !data.language
  ) {
    res.status(400).json({
      message: 'Bad data',
    });
    return;
  }

  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    res.status(401).json({
      message: 'Missing or invalid Authorization header.',
    });
    return;
  }

  let userID: string;
  try {
    const decoded = await auth.verifyIdToken(token);
    userID = decoded.uid;
  } catch {
    res.status(401).json({
      message: 'Invalid Firebase authentication token.',
    });
    return;
  }

  // XXX: Normalize (lowercase, etc.) problem ID?
  const idToURLRef = data.tournamentID
    ? db
        .ref('users')
        .child(userID)
        .child('tournaments')
        .child('tournament-id-to-file-id')
        .child(data.tournamentID.toString())
    : db
        .ref('users')
        .child(userID)
        .child('platform-' + data.platform)
        .child('problem-id-to-file-id')
        .child(data.problemID);

  // Preallocate a candidate file id. This does not create database data
  // until `set()` is called, so losers do not pollute /files.
  const newFileRef = db.ref('/files').push();
  const fileID = newFileRef.key;

  if (!fileID) {
    res.status(500).json({
      message: 'Could not allocate file id.',
    });
    return;
  }

  const txResult = await idToURLRef.transaction(currentValue => {
    if (typeof currentValue === 'string' && currentValue.length > 0) {
      return currentValue;
    }

    return fileID;
  });

  const mappedFileID = txResult.snapshot.val();

  if (typeof mappedFileID !== 'string' || mappedFileID.length === 0) {
    res.status(500).json({ message: 'Invalid file mapping in database.' });
    return;
  }

  if (mappedFileID !== fileID) {
    // This file already exists, or a concurrent createNewPlatformFile request is
    // in the process of creating it. Wait until file metadata is filled by the
    // winner of this race.
    const mappedFileRef = db.ref('files').child(mappedFileID);

    for (let attempt = 0; attempt < FILE_INIT_WAIT_ATTEMPTS; attempt++) {
      const fileSnap = await mappedFileRef.get();
      if (fileSnap.exists()) {
        res.status(200).json({
          fileID: mappedFileID,
        });
        return;
      }

      await new Promise(resolve =>
        setTimeout(resolve, FILE_INIT_WAIT_DELAY_MS)
      );
    }

    res.status(503).json({
      message: 'File is being initialized. Please retry shortly.',
    });
    return;
  }

  const rollbackClaim = async () => {
    await idToURLRef.transaction(currentValue => {
      if (currentValue === fileID) {
        return null;
      }

      return currentValue;
    });
  };

  let problem: ProblemData | null;
  let userName: string;
  try {
    const [fetchedProblem, userRecord] = await Promise.all([
      fetchData({
        platform: data.platform,
        id: data.problemID,
      }),
      auth.getUser(userID),
    ]);

    problem = fetchedProblem;
    userName = userRecord.displayName || userRecord.email || userID;
  } catch (error) {
    await rollbackClaim();
    console.error(error);
    res.status(500).json({ message: 'Failed to initialize platform file.' });
    return;
  }

  if (problem === null) {
    await rollbackClaim();
    res.status(400).json({
      message: 'Could not fetch problem data.',
    });
    return;
  }

  try {
    await newFileRef.set({
      users: {
        [userID]: {
          name: userName,
          color: colorFromUserId(userID),
          permission: 'OWNER',
        },
      },
      problem: { platform: data.platform, id: data.problemID },
      ...(data.tournamentID ? { tournamentID: data.tournamentID } : {}),
      settings: {
        workspaceName: `${problem.source}: ${problem.title}`,
        defaultPermission: data.defaultPermission,
        creationTime: ServerValue.TIMESTAMP,
        language: data.language, //TODO think about how do we support other languages with this method?
        compilerOptions: DEFAULT_COMPILER_OPTIONS,
      },
    });

    if (data.tournamentID) {
      await db
        .ref('tournaments')
        .child(data.tournamentID)
        .child('participants')
        .child(userID)
        .set({
          message: 'unsubmitted',
          statusCode: 'unsubmitted',
          fileID,
          submissionTime: null,
        });
    }
  } catch (error) {
    await Promise.allSettled([rollbackClaim(), newFileRef.remove()]);
    console.error(error);
    res.status(500).json({ message: 'Failed to create platform file.' });
    return;
  }

  res.status(200).json({ fileID });
};
