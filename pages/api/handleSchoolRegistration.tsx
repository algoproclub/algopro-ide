import { NextApiRequest, NextApiResponse } from 'next';
import { compactDecrypt } from 'jose';
import {
  addUserToSchool,
  ensureUserdata,
  markUserRegistered,
} from './registrationUtils';

type RequestData = {
  token: string;
  userID: string;
  name: string | null;
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const data: RequestData = req.body;
  if (!data?.token || !data?.userID) {
    res.status(400).send('Missing token or userID');
    return;
  }

  const { token, userID, name } = data;
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

    ensureUserdata(userID, name);

    addUserToSchool(userID, schoolID);

    markUserRegistered(userID);

    res.status(200).end();
  } catch (e) {
    console.error('Registration error:', e);
    res.status(400).send('Decryption failed or request error');
  }
};
