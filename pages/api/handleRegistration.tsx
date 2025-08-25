import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from 'firebase-admin/database';
import firebaseApp from '../../src/firebaseAdmin';
import { compactDecrypt } from 'jose';

type RequestData = {
  token: string;
  userID: string;
  name: string | null;
};

const db = getDatabase(firebaseApp);

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const data: RequestData = req.body;
  if (!data || !data?.token || !data?.userID) {
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

    const {
      discord_id: discordID,
      callback_url,
      client_auth_header,
      client_auth_secret,
      ...additionalPayload
    } = decodedPayload;

    const resp = await fetch(callback_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [client_auth_header]: client_auth_secret,
      },
      body: JSON.stringify({
        discordID,
        userID,
        ...additionalPayload,
      }),
    });
    if (!resp.ok) {
      res.status(400).send('Request failed');
      return;
    }
    await db.ref(`users/${userID}/data`).update({
      discordID,
    });
    res.status(200).end();
  } catch (e) {
    console.error('Registration error:', e);
    res.status(400).send('Decryption failed or request error');
    return;
  }
};
