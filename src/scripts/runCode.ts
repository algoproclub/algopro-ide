import { getAuth } from 'firebase/auth';
import { Language } from '../context/UserContext';
import CodeRunResult, {
  JudgeResultStatuses as CodeRunStatus,
} from '../types/judge';

type ExecuteResponse = {
  compiled: boolean;
  compiler_output: string;
  verdict: number;
  output: string;
  stderr: string;
  memory: number;
  time: number | string;
};

type RunCodeRequest = {
  code: string;
  input: string;
  language: Language;
};

type RunCodeBatchRequest = {
  code: string;
  inputs: string[];
  language: Language;
};

export type RunCodeErrorKind = 'auth' | 'config' | 'http' | 'network';

export class RunCodeError extends Error {
  kind: RunCodeErrorKind;
  status?: number;

  constructor(
    message: string,
    { kind, status }: { kind: RunCodeErrorKind; status?: number }
  ) {
    super(message);
    this.name = 'RunCodeError';
    this.kind = kind;
    this.status = status;
  }
}

const EXECUTE_URL =
  process.env.NEXT_PUBLIC_EXECUTE_URL ??
  (process.env.NODE_ENV !== 'production' ? 'http://localhost:1235' : undefined);

export function extractJavaFilename(code: string): string {
  const matches = Array.from(code.matchAll(/public +class +(\w+)/g));
  if (matches.length > 0) {
    return matches[0][1] + '.java';
  }
  return 'Main.java';
}

function filenameFor(language: Language, code: string): string {
  return {
    cpp: 'main.cpp',
    java: extractJavaFilename(code),
    py: 'main.py',
  }[language];
}

function mapStatus(verdict: number): CodeRunStatus {
  if (verdict == 1) return 'success';
  if (verdict == 2) return 'time_limit_exceeded';
  if (verdict == 4) return 'runtime_error';
  if (verdict == 8) return 'runtime_error';
  if (verdict == 16) return 'internal_error';
  return 'compile_error';
}

function mapExecuteResult(result: ExecuteResponse): CodeRunResult {
  if (!result.compiled) {
    return {
      message: result.compiler_output,
      status: 'compile_error',
      memory: '',
      stderr: '',
      stdout: '',
      time: '',
      statusDescription: '',
    };
  }

  const time =
    typeof result.time === 'number'
      ? (result.time / 1e9).toString()
      : (parseInt(result.time) / 1e9).toString();

  return {
    compilationMessage: result.compiler_output,
    status: mapStatus(result.verdict),
    memory: result.memory.toString(),
    stderr: result.stderr,
    stdout: result.output,
    time,
    statusDescription: '',
  };
}

async function getIdToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) {
    throw new RunCodeError('You must be logged in to run code.', {
      kind: 'auth',
    });
  }
  try {
    return await user.getIdToken();
  } catch (error) {
    throw new RunCodeError(
      error instanceof Error ? error.message : String(error),
      { kind: 'auth' }
    );
  }
}

function getExecuteUrl(): string {
  if (!EXECUTE_URL) {
    throw new RunCodeError('NEXT_PUBLIC_EXECUTE_URL is not configured.', {
      kind: 'config',
    });
  }
  return EXECUTE_URL;
}

export async function runCode({
  code,
  input,
  language,
}: RunCodeRequest): Promise<CodeRunResult> {
  const executeUrl = getExecuteUrl();
  const idToken = await getIdToken();
  return runCodeWithToken({ code, input, language }, idToken, executeUrl);
}

async function runCodeWithToken(
  { code, input, language }: RunCodeRequest,
  idToken: string,
  executeUrl: string
): Promise<CodeRunResult> {
  let executeResponse: Response;
  try {
    executeResponse = await fetch(`${executeUrl}/execute`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        language,
        filename: filenameFor(language, code),
        source: code,
        input,
      }),
    });
  } catch (error) {
    throw new RunCodeError(
      error instanceof Error ? error.message : String(error),
      { kind: 'network' }
    );
  }

  if (!executeResponse.ok) {
    const message = await executeResponse.text();
    throw new RunCodeError(
      message || `Execute server returned ${executeResponse.status}.`,
      {
        kind: 'http',
        status: executeResponse.status,
      }
    );
  }

  return mapExecuteResult(await executeResponse.json());
}

export async function runCodeBatch({
  code,
  inputs,
  language,
}: RunCodeBatchRequest): Promise<CodeRunResult[]> {
  const executeUrl = getExecuteUrl();
  const idToken = await getIdToken();
  return Promise.all(
    inputs.map(input =>
      runCodeWithToken({ code, input, language }, idToken, executeUrl)
    )
  );
}
