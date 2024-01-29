import type { NextApiRequest, NextApiResponse } from 'next';
import { Language } from '../../src/context/EditorContext';

type RequestData = {
  compilerOptions: string;
  filename: string;
  input: string;
  language: Language;
  sourceCode: string;
};

type ResponseData = {
  compilationMessage: string;
  status:
    | 'success'
    | 'internal_error'
    | 'wrong_answer'
    | 'time_limit_exceeded'
    | 'runtime_error'
    | 'compile_error';
  stdout: string;
  stderr: string;
  time: string;
  memory: string;
};

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) => {
  const requestData: RequestData = req.body;
  const executeResponse = await fetch('http://execute:1235/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      language: requestData.language,
      filename: requestData.filename,
      source: btoa(requestData.sourceCode),
      input: btoa(requestData.input),
    }),
  });

  const result = await executeResponse.json();
  if (!result.compiled) {
    res.status(200).json({
      compilationMessage: result.compiler_output,
      status: 'compile_error',
      memory: '',
      stderr: '',
      stdout: '',
      time: '',
    });
  } else {
    res.status(200).json({
      compilationMessage: result.compiler_output,
      status: 'success', //TODO map from language.Verdict
      memory: result.memory,
      stderr: result.stderr,
      stdout: result.output,
      time: result.time,
    });
  }
};
