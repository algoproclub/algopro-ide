import type { NextApiRequest, NextApiResponse } from 'next';
import { Language } from '../../src/context/EditorContext';

type RequestData = {
  compilerOptions: string;
  fileName: string;
  input: string;
  language: Language;
  sourceCode: string;
};

type ResponseData = {
  compilationMessage: string;
  status: 'success' | 'internal_error' | 'compile_error';
  stdout: string;
  stderr: string;
  time: string;
  memory: string;
};

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) => {
  res.status(200).json({
    compilationMessage: '',
    status: 'success',
    stdout: '1+2+3',
    stderr: 'teszt1',
    time: 'teszt2',
    memory: 'teszt3',
  });
};
