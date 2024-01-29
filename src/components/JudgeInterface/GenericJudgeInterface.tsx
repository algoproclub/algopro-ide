import { useAtomValue } from 'jotai/utils';
import React, { useState, useEffect, useRef } from 'react';
import { mainEditorValueAtom } from '../../atoms/workspace';
import { StatusData } from '../Workspace/Workspace';
import SubmitButton from './SubmitButton';
import { PlayCircleIcon } from '@heroicons/react/20/solid';
import Markdown from './Markdown';
import { getFirestore, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useEditorContext } from '../../context/EditorContext';
import {
  ProblemData,
  ProblemSolution,
  SubmissionData,
} from '../../types/problem';

const submitProblemSolution = httpsCallable<ProblemSolution, SubmissionData>(
  getFunctions(),
  'submitProblemSolution'
);

export default function GenericJudgeInterface({
  problem,
  statusData,
  setStatusData,
  handleRunCode,
}: {
  problem: ProblemData;
  statusData: StatusData | null;
  setStatusData: React.Dispatch<React.SetStateAction<StatusData | null>>;
  handleRunCode: () => void;
}): JSX.Element {
  const getMainEditorValue = useAtomValue(mainEditorValueAtom)!;
  const language = useEditorContext().fileData.settings.language;

  const handleSubmit = async () => {
    const submissionData = await submitProblemSolution({
      platform: problem.platform,
      problemID: problem.id,
      language,
      sourceCode: getMainEditorValue(),
    });
    console.log('submission success', submissionData);
  };

  return (
    <div className="relative h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-0">
          <div>
            <p className="text-gray-100 font-bold text-lg">{problem.title}</p>
            <div
              dangerouslySetInnerHTML={{ __html: problem.statement ?? '' }}
            ></div>
          </div>
        </div>
      </div>
      <SubmitButton
        isLoading={(statusData?.statusCode ?? 0) <= -8}
        isDisabled={!problem.submittable}
        onClick={handleSubmit}
      />
    </div>
  );
}
