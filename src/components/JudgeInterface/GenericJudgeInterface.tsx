import { useAtomValue } from 'jotai/utils';
import React, { useState, useEffect, useRef } from 'react';
import { mainEditorValueAtom } from '../../atoms/workspace';
import { StatusData } from '../../types/problem';
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
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';

const submitProblemSolution = httpsCallable<ProblemSolution, SubmissionData>(
  getFunctions(undefined, 'europe-west1'),
  'submitproblemsolution'
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
        <section id="problem-statement" className="p-4 pb-0">
          <h3>
            <a
              href={problem.url}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-lg hover:underline flex flex-row items-center"
            >
              {problem.title}
              <ArrowTopRightOnSquareIcon
                aria-hidden="true"
                className="ml-1 h-5 w-5"
              />
            </a>
          </h3>
          <div
            dangerouslySetInnerHTML={{ __html: problem.statement ?? '' }}
          ></div>
        </section>
      </div>
      <SubmitButton
        isLoading={(statusData?.statusCode ?? 0) <= -8}
        isDisabled={!problem.submittable}
        onClick={handleSubmit}
      />
    </div>
  );
}
