export type JudgeResultStatuses =
  | 'success'
  | 'compile_error'
  | 'runtime_error'
  | 'memory_limit_exceeded'
  | 'time_limit_exceeded'
  | 'wrong_answer'
  | 'internal_error';
export default interface JudgeResult {
  statusDescription?: string;
  status: JudgeResultStatuses;
  stdout?: string;
  stderr?: string;
  message?: string;
  compilationMessage?: string;
  time?: number;
  memory?: number;
  signal?: number;
  debugData?: any;
  fileOutput?: string;
}
export interface Sample {
  input: string;
  output: string;
}
