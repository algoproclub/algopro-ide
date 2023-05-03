import { useAtomValue } from 'jotai/utils';
import React, { useState, useEffect } from 'react';
import { currentLangAtom, mainMonacoEditorAtom } from '../../atoms/workspace';
import USACOResults from './USACOResults';
import { ProblemData, StatusData } from '../Workspace/Workspace';
import SubmitButton from './SubmitButton';
import { PlayCircleIcon } from '@heroicons/react/20/solid';
import Markdown from './Markdown';
import firebase from 'firebase/app';
import 'firebase/firestore';

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
  const lang = useAtomValue(currentLangAtom);

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

    const data = {
      problemID: problem.id,
      language: { cpp: 'c++17', java: 'java', py: 'python3' }[lang],
      base64Code: encode(mainMonacoEditor.getValue()),
    };

    const resp = await fetch(`${judgePrefix}/submit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    const submissionID = await resp.text();

    const checkStatus = async () => {
      const statusResp = await fetch(
        `${judgePrefix}/submission/${submissionID}`
      );
      const data = await statusResp.json();
      setStatusData(data);

      if (data.statusCode && parseInt(data.statusCode) <= -8) {
        // still working
        setTimeout(checkStatus, 1000);
      }
    };

    setTimeout(checkStatus, 1000);
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
            {problem.samples?.length > 0 && (
              <button
                type="button"
                className="relative flex-shrink-0 inline-flex items-center px-4 py-2 w-40 shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:bg-indigo-800 focus:outline-none"
                onClick={handleRunCode}
              >
                <PlayCircleIcon className="mr-2 h-5 w-5" aria-hidden="true" />
                <span className="text-center flex-1">Run Samples</span>
              </button>
            )}
          </>
        </div>
        <div className="px-4">
          <USACOResults data={statusData} />
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
