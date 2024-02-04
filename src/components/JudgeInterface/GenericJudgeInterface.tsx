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
import { useUserContext } from '../../context/UserContext';
import LoadResultsModal from './LoadResultsModal';
import { submitproblemsolution } from '../../../functions/src';
import {
  registerSubmission,
  resetStatusData,
} from '../../scripts/updateStatus';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';

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
  const { fileData } = useEditorContext();
  const { userData } = useUserContext();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const getMainEditorValue = useAtomValue(mainEditorValueAtom)!;

  const handleSubmit = async () => {
    const getSubmitLink = () => {
      const codeforcesRegex = /^(\d+)([A-Z].*)$/;
      const platform = problem.platform;
      const problemID = problem.id;
      const matches = problemID.match(codeforcesRegex)!;

      let submitLink = '';
      if (platform === 'codeforces') {
        submitLink = `https://codeforces.com/problemset/problem/${matches[1]}/${matches[2]}`;
      }
      if (platform === 'atcoder') {
        submitLink = `https://atcoder.jp/contests/${
          problemID.split('_')[0]
        }/tasks/${problemID}`;
      }
      if (platform === 'cses') {
        submitLink = `https://cses.fi/problemset/submit/${problemID}/`;
      }
      return submitLink;
    };
    if (userData.manualSubmission) {
      const link = getSubmitLink();
      window.open(link, '_blank');
      setIsOpen(true);
    } else {
      try {
        setStatusData({
          statusCode: 'starting',
          message: 'starting',
          statusText: null,
          link: null,
          time: null,
          memory: null,
          output: null,
          testCases: null,
        });
        const submissionData = await submitProblemSolution({
          platform: problem.platform,
          problemID: problem.id,
          language: fileData.settings.language,
          sourceCode: getMainEditorValue(),
        });
        registerSubmission(
          fileData.id,
          submissionData.data.id,
          submissionData.data.username,
          setStatusData
        );
        console.log('submission success', submissionData);
      } catch (error) {
        resetStatusData(fileData.id, setStatusData);
        console.error(error);
      }
    }
  };

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current !== null) {
      renderMathInElement(ref.current, {
        delimiters: [
          // For Codeforces
          { left: '$$$', right: '$$$', display: false },
          { left: '$$$$$', right: '$$$$$', display: true },
        ],
      });
    }
  }, [ref.current]);

  return (
    <div className="relative h-full flex flex-col">
      <LoadResultsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        setStatusData={setStatusData}
      />
      <div className="flex-1 overflow-y-auto">
        <section className="p-4 pb-0">
          <h3>
            <a
              href={problem.url}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-xl hover:underline flex flex-row items-center"
            >
              {problem.title}
              <ArrowTopRightOnSquareIcon
                aria-hidden="true"
                className="ml-1 h-5 w-5"
              />
            </a>
          </h3>
          <div
            id="problem-statement"
            dangerouslySetInnerHTML={{ __html: problem.statement ?? '' }}
            ref={ref}
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
