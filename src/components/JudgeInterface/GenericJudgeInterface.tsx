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
import {
  registerSubmission,
  resetStatusData,
} from '../../scripts/updateStatus';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';
import katex from 'katex';

const submitProblemSolution = httpsCallable<ProblemSolution, SubmissionData>(
  getFunctions(undefined, 'europe-west1'),
  'submitproblemsolution'
);

export default function GenericJudgeInterface({
  problem,
}: {
  problem: ProblemData;
}): JSX.Element {
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

      // For AtCoder
      ref.current.querySelectorAll('var').forEach(element => {
        katex.render(element.textContent ?? '', element);
      });

      // For CSES
      ref.current.querySelectorAll('.math').forEach(element => {
        if (!(element instanceof HTMLElement)) return;

        katex.render(element.textContent ?? '', element, {
          displayMode: element.classList.contains('display'),
        });
      });
    }
  }, [ref.current]);

  return (
    <div className="relative h-full flex flex-col">
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
          <style jsx global>{`
            #problem-statement p {
              margin-bottom: 0.5rem;
            }

            #problem-statement .section-title {
              font-size: 1.125rem;
              font-weight: 600;
            }
          `}</style>
        </section>
      </div>
    </div>
  );
}
