import { NextApiRequest, NextApiResponse } from 'next';
import {
  getSignedKeyDirectory,
  rotateKeyIfNeeded,
} from '../../../src/utils/signatureUtils';
import { appendSignature } from 'http-message-sig';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;
  res.setHeader(
    'Content-Type',
    'application/http-message-signatures-directory+json'
  );

  if (method === 'GET') {
    const signedDirectory = await getSignedKeyDirectory(req.headers.host ?? '');
    let headers = new Headers();
    signedDirectory.signatureData.forEach(
      fields => (headers = appendSignature(headers, fields))
    );
    headers.forEach((value, key) => res.appendHeader(key, value));
    res.status(200).send(
      // .json() ruins Content-Type
      JSON.stringify(signedDirectory.directory)
    );
  } else if (method === 'PATCH') {
    await rotateKeyIfNeeded();
    res.status(200).end();
  } else {
    // Handle any other HTTP method
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${method} Not Allowed`);
  }
}
