import { NextApiRequest, NextApiResponse } from 'next';

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const resp = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: 'DeepL-Auth-Key [key]',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [req.body.text],
      target_lang: 'HU',
    }),
  });
  res.status(200).json(await resp.json());
};
