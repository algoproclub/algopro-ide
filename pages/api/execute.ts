import type { NextApiRequest, NextApiResponse } from 'next';
import { Language } from '../../src/context/EditorContext';
import { SHOULD_USE_DEV_EXECUTE_SERVER } from '../../src/dev_constants';

type RequestData = {
  compilerOptions: string;
  filename: string;
  input: string;
  language: Language;
  sourceCode: string;
};

type StatusType =
  | 'success'
  | 'internal_error'
  | 'wrong_answer'
  | 'time_limit_exceeded'
  | 'runtime_error'
  | 'compile_error';

type ResponseData = {
  compilationMessage?: string;
  message?: string;
  status: StatusType;
  stdout: string;
  stderr: string;
  time: string;
  memory: string;
};

function mapResult(verdict: number): StatusType {
  if (verdict == 1) return 'success';
  if (verdict == 2) return 'time_limit_exceeded';
  if (verdict == 4) return 'runtime_error';
  if (verdict == 8) return 'runtime_error';
  if (verdict == 16) return 'internal_error';
  return 'compile_error';
}

function utf8btoa(input: string): string {
  const buffer = Buffer.from(input, 'utf-8');
  return buffer.toString('base64');
}
export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) => {
  const requestData: RequestData = req.body;
  const execute_url = SHOULD_USE_DEV_EXECUTE_SERVER
    ? 'http://execute:1235'
    : 'http://51.21.132.241:1235';
  const executeResponse = await fetch(execute_url + '/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      language: requestData.language,
      filename: requestData.filename,
      source: utf8btoa(requestData.sourceCode),
      input: utf8btoa(requestData.input),
    }),
  });

  const result = await executeResponse.json();
  if (!result.compiled) {
    res.status(200).json({
      message: result.compiler_output,
      status: 'compile_error',
      memory: '',
      stderr: '',
      stdout: '',
      time: '',
    });
  } else {
    res.status(200).json({
      compilationMessage: result.compiler_output,
      status: mapResult(result.verdict),
      memory: result.memory,
      stderr: result.stderr,
      stdout: result.output,
      time: (parseInt(result.time) / 1e9).toString(),
    });
  }
};
