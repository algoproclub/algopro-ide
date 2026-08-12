import { useEditorContext } from '../context/EditorContext';
import JudgeResult from '../types/judge';

export default function useJudgeResults() {
  const { fileData, updateFileData } = useEditorContext();
  return [
    fileData.state?.judge_resuts ?? [],
    (new_judge_results: JudgeResult[]) =>
      updateFileData({
        state: { ...fileData.state, judge_resuts: new_judge_results },
      }),
  ];
}
