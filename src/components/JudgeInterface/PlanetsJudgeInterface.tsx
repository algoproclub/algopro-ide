import { useAtomValue } from 'jotai/utils';
import React, { useState, useEffect } from 'react';
import { mainMonacoEditorAtom } from '../../atoms/workspace';
import { ProblemData, StatusData } from '../Workspace/Workspace';
import SubmitButton from './SubmitButton';
import { PlayCircleIcon } from '@heroicons/react/20/solid';
import Markdown from './Markdown';
import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/functions';
import { useEditorContext } from '../../context/EditorContext';

export const judgePrefix = 'https://vjudge.usaco.guide';

function encode(str: string | null) {
  return btoa(unescape(encodeURIComponent(str || '')));
}

const firestore = firebase.firestore();

const getProblemStatement = async (id: string, language: string) => {
  const docSnap = await firestore
    .collection('problems')
    .doc(id)
    .collection('statements')
    .doc(language)
    .get();
  if (docSnap.exists) {
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

const mapVerdictToStatusCode = (verdict: string): number => {
  if (verdict.startsWith('Starting') || verdict.startsWith('Running'))
    return -8;
  return 0;
};

const convertPlanetsResultToStatusData = (result: any): StatusData => {
  return {
    statusText: 'status-working',
    message: result.verdict,
    statusCode: mapVerdictToStatusCode(result.verdict),
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
      statusCode: -100,
    });

    const submissionData = {
      problem_id: problem.id,
      language: { cpp: 'cpp17', java: 'java', py: 'python3' }[lang],
      solution: mainMonacoEditor.getValue(),
    };

    const submit = firebase
      .app()
      .functions('europe-west1')
      .httpsCallable('submit');

    const response = await submit(submissionData);
    const id = response.data.id;
    const unsubscribe = firestore
      .collection('submissions')
      .doc(id)
      .onSnapshot(doc => {
        setStatusData(convertPlanetsResultToStatusData(doc.data()));
        if (mapVerdictToStatusCode(doc.data()?.verdict) == 0) {
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
                className="relative flex-shrink-0 inline-flex items-center px-4 py-2 w-40 shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:bg-indigo-800 focus:outline-none"
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
        isLoading={(statusData?.statusCode ?? 0) <= -8}
        isDisabled={!problem.submittable}
        onClick={() => handleSubmit()}
      />
    </div>
  );
}
