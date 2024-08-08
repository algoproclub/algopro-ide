import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { getDatabase } from 'firebase-admin/database';
import firebaseApp from '../../src/firebaseAdmin';

type RequestData = {
  token: string;
  userID: string;
};

const db = getDatabase(firebaseApp);

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const data: RequestData = req.body;
  if (!data || !data.token || !data.userID) {
    res.status(400).send('Bad data');
    return;
  }
  const { token, userID } = data;
  const secret = process.env.ONBOARDING_SECRET ?? 'secret';
  try {
    jwt.verify(token, secret);
  } catch (e) {
    res.status(400).send('JWT verification failed');
    return;
  }
  const payload = jwt.verify(token, secret) as JwtPayload;
  const discordID = payload.discord_id;

  try {
    const resp = await fetch(payload.callback_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [payload.client_auth_header]: payload.client_auth_secret,
      },
      body: JSON.stringify({
        discordID,
        userID,
      }),
    });
    if (!resp.ok) {
      res.status(400).send('Request failed');
      return;
    }
    await db.ref(`users/${userID}/data`).update({
      discordID: discordID,
    });
    res.status(200).end();
  } catch (e) {
    res.status(400).send('Request failed');
    return;
  }
};
