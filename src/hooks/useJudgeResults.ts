import { useEditorContext } from '../context/EditorContext';
import JudgeResult, { JudgeResultStatuses } from '../types/judge';
import { getJudgeStatusDescription } from '../utils/editorUtils';

export type SampleJudgeResults = Array<JudgeResult | null>;

const verdictCodes: Record<JudgeResultStatuses, string> = {
  success: 'A',
  wrong_answer: 'W',
  time_limit_exceeded: 'T',
  memory_limit_exceeded: 'M',
  runtime_error: 'R',
  compile_error: '?',
  internal_error: '?',
};

function normalizeSampleResults(value: unknown): SampleJudgeResults {
  if (Array.isArray(value)) {
    return value as SampleJudgeResults;
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const results: SampleJudgeResults = [];
  for (const [key, result] of Object.entries(value)) {
    const index = Number(key);
    if (Number.isInteger(index) && index >= 0) {
      results[index] = result as JudgeResult | null;
    }
  }
  return results;
}

export function summarizeSampleJudgeResults(
  results: SampleJudgeResults,
  sampleCount: number
): JudgeResult | null {
  const availableResults = results
    .slice(0, sampleCount)
    .filter((result): result is JudgeResult => Boolean(result));
  if (availableResults.length === 0) {
    return null;
  }

  const representativeResult =
    availableResults.find(result => result.status !== 'success') ??
    availableResults[availableResults.length - 1];
  if (sampleCount <= 1) {
    return representativeResult;
  }

  const verdicts = Array.from({ length: sampleCount }, (_, index) => {
    const result = results[index];
    return result ? verdictCodes[result.status] : '?';
  }).join('');

  return {
    ...representativeResult,
    statusDescription: `Sample Verdicts: ${verdicts}. ${getJudgeStatusDescription(representativeResult)}`,
  };
}

function getJudgeResultForTab(
  tabId: string,
  inputResult: JudgeResult | null,
  sampleResults: SampleJudgeResults,
  sampleCount: number
): JudgeResult | null {
  if (tabId === 'input') {
    return inputResult;
  }

  if (tabId.startsWith('Sample')) {
    const sampleNumber = tabId === 'Sample' ? 1 : Number(tabId.substring(7));
    if (sampleNumber > sampleCount) return null;
    return sampleResults[sampleNumber - 1] ?? null;
  }

  return summarizeSampleJudgeResults(sampleResults, sampleCount);
}

export default function useJudgeResults() {
  const { fileData, updateFileData } = useEditorContext();
  const inputResult = fileData.state?.input_judge_result ?? null;
  const sampleResults = normalizeSampleResults(
    fileData.state?.sample_judge_results
  );

  return {
    getResultForTab: (tabId: string, sampleCount: number) =>
      getJudgeResultForTab(tabId, inputResult, sampleResults, sampleCount),
    sampleResults,
    setInputResult: (result: JudgeResult | null) =>
      updateFileData({
        'state/input_judge_result': result,
      }),
    setSampleResults: (results: SampleJudgeResults) =>
      updateFileData({
        'state/sample_judge_results': results,
      }),
  };
}
