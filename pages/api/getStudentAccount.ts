import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseApp from '../../src/firebaseAdmin';
import type { StudentAccount } from '../../src/data/userProfile';

type RequestData = {
  userID?: string;
};

type ResponseData = StudentAccount | { message: string };

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

/**
 * Sign-in email addresses live in Firebase Authentication rather than in
 * Firestore, so the student profile page cannot read them directly.
 */
export default async function getStudentAccount(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!req.body || typeof req.body !== 'object')
    return res.status(400).json({ message: 'Invalid request data' });
  const { userID } = req.body as RequestData;
  if (typeof userID !== 'string' || userID.length === 0 || userID.includes('/'))
    return res.status(400).json({ message: 'Missing required data' });

  const idToken = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!idToken)
    return res
      .status(401)
      .json({ message: 'Missing or invalid Authorization header.' });

  let caller: DecodedIdToken;
  try {
    caller = await auth.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ message: 'Invalid authentication token' });
  }

  if (caller.registered !== true)
    return res.status(403).json({ message: 'Registration required' });

  if (caller.admin !== true && caller.uid !== userID) {
    const schools = (await firestore.doc(`userdata/${userID}`).get()).get(
      'schools'
    );
    const teacherSchools = Array.isArray(caller.teacher) ? caller.teacher : [];
    if (
      !Array.isArray(schools) ||
      !schools.some(school => teacherSchools.includes(school))
    )
      return res.status(403).json({ message: 'Not authorized for this user' });
  }

  try {
    const user = await auth.getUser(userID);
    return res.status(200).json({ email: user.email ?? null });
  } catch {
    // Userdata documents can outlive the account they were created for.
    return res.status(200).json({ email: null });
  }
}
