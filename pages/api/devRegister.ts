import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import firebaseApp from '../../src/firebaseAdmin';
import { SHOULD_USE_FIREBASE_EMULATOR } from '../../src/dev_constants';

/**
 * DEV-ONLY: grant the `registered` custom claim to an emulator user.
 *
 * The RTDB security rules (database.rules.json) require `auth.token.registered
 * === true` to read/write any file. In production that claim is set by the real
 * school-registration flow; against the local Firebase emulator there is no such
 * flow, so a freshly signed-in user can't open any workspace ("this file is
 * private"). This endpoint sets the claim so local dev is usable.
 *
 * Defense-in-depth gate (this grants the exact claim the RTDB rules trust, so a
 * leak would be privilege escalation): require BOTH the non-production flag AND
 * the live auth-emulator host — the real "we're on the emulator" signal — and
 * fail CLOSED. On Vercel/production neither holds, so it is always a 403.
 */
export default async (req: NextApiRequest, res: NextApiResponse) => {
  const onEmulator =
    SHOULD_USE_FIREBASE_EMULATOR && !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!onEmulator) {
    res
      .status(403)
      .json({ message: 'devRegister is disabled outside the emulator' });
    return;
  }
  const uid = (req.body as { uid?: unknown })?.uid;
  if (typeof uid !== 'string' || !uid) {
    res.status(400).json({ message: 'missing uid' });
    return;
  }
  await getAuth(firebaseApp).setCustomUserClaims(uid, { registered: true });
  res.status(200).json({ ok: true });
};
