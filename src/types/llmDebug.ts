export type LLMDebugResult = {
  verdict: 'buggy' | 'correct';
  findings: { line: number; reason: string }[];
  summary: string;
  statementWarning: string | null;
};

export type LLMDebugResponse =
  | ({ ok: true } & LLMDebugResult)
  | { ok: false; message: string };

export type LLMDebugRun = { fileId: string; code: string } & (
  | { status: 'loading' }
  | { status: 'done'; result: LLMDebugResult }
  | { status: 'error'; message: string }
);
