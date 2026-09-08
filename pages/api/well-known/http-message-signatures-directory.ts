import { NextApiRequest, NextApiResponse } from 'next';
import {
  getSignedKeyDirectory,
  rotateKeyIfNeeded,
} from '../../../src/utils/signatureUtils';
import { appendSignature, RequestDescriptor } from 'http-message-sig';

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
    const request: RequestDescriptor = {
      kind: 'request',
      method: 'GET',
      targetUri: `https://${req.headers.host}/.well-known/http-message-signatures-directory`,
      fields: [{ name: 'req', value: 'true' }],
    };
    const signedDirectory = await getSignedKeyDirectory(request);
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
