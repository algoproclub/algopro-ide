import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import firebaseApp from '../../src/firebaseAdmin';
import { compactDecrypt } from 'jose';

type RequestData = {
  token: string;
  userID: string;
};

const db = getDatabase(firebaseApp);
const firestore = getFirestore(firebaseApp);

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const data: RequestData = req.body;
  if (!data?.token || !data?.userID) {
    res.status(400).send('Missing token or userID');
    return;
  }

  const { token, userID } = data;
  const secret =
    process.env.ONBOARDING_SECRET ?? 'abcdabcdabcdabcdabcdabcdabcdabcd';
  const secretKey = new TextEncoder().encode(secret);

  try {
    const { plaintext } = await compactDecrypt(token, secretKey);
    const decodedPayload = JSON.parse(new TextDecoder().decode(plaintext));
    const { school_id: schoolID, exp } = decodedPayload;

    if (!schoolID || typeof exp !== 'number') {
      res.status(400).send('Invalid token payload');
      return;
    }

    const now = Date.now();
    if (exp < now) {
      res.status(400).send('Token expired');
      return;
    }
    const rtdbRef = db.ref(`users/${userID}/schools`);
    await rtdbRef.transaction(current => {
      if (Array.isArray(current)) {
        return current.includes(schoolID) ? current : [...current, schoolID];
      }
      return [schoolID];
    });

    const userDocRef = firestore.doc(`userdata/${userID}`);
    await userDocRef.set(
      { schools: FieldValue.arrayUnion(schoolID) },
      { merge: true }
    );

    res.status(200).end();
  } catch (e) {
    console.error('Registration error:', e);
    res.status(400).send('Decryption failed or request error');
  }
};
