import { useAtomValue } from 'jotai/utils';
import React from 'react';
import { mainMonacoEditorAtom } from '../../atoms/workspace';
import USACOResults from './USACOResults';
import { ProblemData, StatusData } from '../Workspace/Workspace';
import SubmitButton from './SubmitButton';
import { PlayCircleIcon } from '@heroicons/react/20/solid';
import { useEditorContext } from '../../context/EditorContext';

export const judgePrefix = 'https://vjudge.usaco.guide';

function encode(str: string | null) {
  return btoa(unescape(encodeURIComponent(str || '')));
}

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
            <p className="text-gray-100 font-bold text-lg">{problem.title}</p>
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
