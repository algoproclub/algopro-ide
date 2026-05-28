import { NextApiRequest, NextApiResponse } from 'next';

type RequestData = {
  discordID: string;
  userID: string;
};

export default (req: NextApiRequest, res: NextApiResponse) => {
  const data: RequestData = req.body;
  console.log(data);

  if (req.headers.authorization !== 'secret') {
    res.status(400).send('Bad secret');
  }
  res.status(200).end();
};
