import { useAtomValue } from 'jotai/utils';
import React, { useState, useEffect } from 'react';
import { mainMonacoEditorAtom } from '../../atoms/workspace';
import SubmitButton from './SubmitButton';
import { PlayCircleIcon } from '@heroicons/react/20/solid';
import Markdown from './Markdown';
import { getFirestore, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/functions';
import { useEditorContext } from '../../context/EditorContext';
import { ProblemData, StatusCode, StatusData } from '../../types/problem';

export const judgePrefix = 'https://vjudge.usaco.guide';

function encode(str: string | null) {
  return btoa(unescape(encodeURIComponent(str || '')));
}

const firestore = getFirestore();

const getProblemStatement = async (id: string, language: string) => {
  const docSnap = await getDoc(
    doc(firestore, 'problems', id, 'statements', language)
  );
  if (docSnap.exists()) {
    return docSnap.data();
  } else {
    return { content: null };
  }
};

const mapVerdictToSymbol = (verdict: string): string => {
  if (verdict == 'Accepted') return '✓';
  if (verdict == 'Did not run') return '?';
  return 'x';
};

const mapVerdictToTitle = (verdict: string): string => {
  if (verdict == 'Accepted') return 'Correct answer';
  if (verdict == 'Wrong answer') return 'Incorrect answer';
  return verdict;
};

const mapVerdictToStatusCode = (verdict: string): StatusCode => {
  if (verdict.startsWith('Starting') || verdict.startsWith('Running'))
    return 'working';
  return 'resolved';
};

const convertPlanetsResultToStatusData = (result: any): StatusData => {
  return {
    link: null,
    memory: null,
    time: null,
    statusText: 'status-working',
    message: result.verdict,
    statusCode: mapVerdictToStatusCode(result.verdict),
    output: result.compiler_output ?? '',
    testCases:
      result.test_results == undefined
        ? []
        : result.test_results.map((t: any) => ({
            title: mapVerdictToTitle(t.verdict),
            trialNum: t.index,
            symbol: mapVerdictToSymbol(t.verdict),
            memory: Math.round(t.memory / 10000) / 100 + 'MB',
            time: Math.round(t.time / 1000000) + 'ms',
          })),
  };
};

export default function PlanetsJudgeInterface({
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
  const mainMonacoEditor = useAtomValue(mainMonacoEditorAtom);
  const lang = useEditorContext().fileData.settings.language;

  const [loading, setLoading] = useState(true);
  const [mdText, setMdText] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      getProblemStatement(problem.id, 'en').then(data => {
        setMdText(data?.content);
        setLoading(false);
      });
    };
    fetchData();
  }, [problem.id]);

  const handleSubmit = async () => {
    if (!mainMonacoEditor || !lang) {
      alert('Error: Page still loading?');
      return;
    }
    setStatusData({
      message: 'Sending submission to server',
      statusCode: 'resolved',
      statusText: null,
      testCases: null,
      output: null,
      memory: null,
      time: null,
      link: null,
    });

    const submissionData = {
      problem_id: problem.id,
      language: { cpp: 'cpp17', java: 'java', py: 'python3' }[lang],
      solution: mainMonacoEditor.getValue(),
    };

    const submit = httpsCallable<unknown, { id: string }>(
      getFunctions(undefined, 'europe-west1'),
      'submit'
    );

    const response = await submit(submissionData);
    const id = response.data.id;
    const unsubscribe = onSnapshot(doc(firestore, 'submissions', id), doc => {
      setStatusData(convertPlanetsResultToStatusData(doc.data()));
      if (
        ['error', 'resolved'].includes(
          mapVerdictToStatusCode(doc.data()?.verdict)
        )
      ) {
        unsubscribe();
      }
    });
  };

  return (
    <div className="relative h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-0">
          <>
            {loading ? (
              <div>
                <p className="text-gray-100 font-bold text-lg">
                  {problem.title}
                </p>
                <div className="text-gray-400 mt-6">Loading...</div>
              </div>
            ) : (
              <Markdown className="text-base" children={mdText} />
            )}
            {problem.samples?.length > 0 && problem.samples[0].output && (
              <button
                type="button"
                className="relative flex-shrink-0 mt-4 mb-8 inline-flex items-center px-4 py-2 w-40 shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:bg-indigo-800 focus:outline-none"
                onClick={handleRunCode}
              >
                <PlayCircleIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                <span className="text-center flex-1 m-2">Run Samples</span>
              </button>
            )}
          </>
        </div>
      </div>
      <SubmitButton
        isLoading={
          statusData !== null &&
          !['error', 'resolved'].includes(statusData.statusCode)
        }
        isDisabled={!problem.submittable}
        onClick={() => handleSubmit()}
      />
    </div>
  );
}
