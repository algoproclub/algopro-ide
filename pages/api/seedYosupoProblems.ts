import type { NextApiRequest, NextApiResponse } from 'next';
import type { TagProblem } from '../../src/types/problem';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseApp from '../../src/firebaseAdmin';
import { getYosupoProblems } from './yosupoProblems';

type Result = {
  attempted: number;
  upserted: number;
  errors: number;
  message?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Result>
) {
  try {
    const force = req.query.force === '1';
    const limit = Number(req.query.limit ?? '0');

    const problems = await getYosupoProblems(force);
    const items = limit > 0 ? problems.slice(0, limit) : problems;

    const db = getFirestore(firebaseApp);
    let upserted = 0;
    let errors = 0;

    for (const p of items) {
      try {
        // Normalize minimal shape expected by Problems page
        const docRef = db
          .collection('problemsets')
          .doc('yosupo')
          .collection('problems')
          .doc(p.id || '');
        if (!p.id) continue;
        await docRef.set(
          {
            id: p.id,
            platform: 'yosupo',
            title: p.title ?? p.id,
            url:
              p.url || `https://judge.yosupo.jp/problem/${p.id}`,
            tags: p.tags ?? null,
          } satisfies TagProblem,
          { merge: true }
        );
        upserted++;
      } catch (_) {
        errors++;
      }
    }

    res.status(200).json({ attempted: items.length, upserted, errors });
  } catch (e: any) {
    res.status(500).json({ attempted: 0, upserted: 0, errors: 1, message: String(e?.message || e) });
  }
}

