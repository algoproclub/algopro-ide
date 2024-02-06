import React, { ComponentType } from 'react';
import { PlayCircleIcon } from '@heroicons/react/20/solid';
import { Sample } from '../../types/problem';
import SubmitButton from './SubmitButton';
import { useEditorContext } from '../../context/EditorContext';
import LoadingIndicator from '../LoadingIndicator';
import useUserPermission from '../../hooks/useUserPermission';

export function getSampleIndex(inputTab: string): number {
  return inputTab.length === 6 ? 1 : +inputTab.substring(7);
}

const PreBox = ({ title, text }: { title: string; text: string }) => {
  return (
    <div className="mx-0 rounded-md mt-4 mb-4 break-all bg-[#121212] border border-t-0 border-[#363636]">
      <div className="py-2.5 px-4 bg-gray-800 border-b border-t rounded-t-md border-[#363636] font-semibold text-sm">
        <span>{title}</span>
      </div>
      <pre className="px-4 py-3 whitespace-pre-wrap">{text}</pre>
    </div>
  );
};

export default function Samples({
  samples,
  inputTab,
  handleRunCode,
}: {
  samples: Sample[];
  inputTab: string;
  handleRunCode: () => void;
}): JSX.Element {
  const index = getSampleIndex(inputTab);
  const sample = samples[index - 1];
  const { fileData } = useEditorContext();
  const permission = useUserPermission();
  const readOnly = !(permission === 'OWNER' || permission === 'READ_WRITE');

  return (
    <div className="text-sm">
      <div className="border-b border-[#363636] -mx-4 px-4 pb-4">
        <button
          type="button"
          title={
            readOnly ? "You can't run code in a view-only document." : undefined
          }
          disabled={readOnly || fileData.isCodeRunning}
          className="rounded-md relative flex-shrink-0 inline-flex items-center px-4 py-2.5 w-40 shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:bg-indigo-800 focus:outline-none disabled:text-indigo-300/50 disabled:bg-indigo-900/50 disabled:cursor-not-allowed"
          onClick={handleRunCode}
        >
          {fileData.isCodeRunning ? (
            <>
              <LoadingIndicator className="h-5 w-5 p-0.5 mr-1.5" />
              <span className="text-center flex-1">Running...</span>
            </>
          ) : (
            <>
              <PlayCircleIcon className="mr-2 h-5 w-5" aria-hidden="true" />
              <span className="text-center flex-1">Run {inputTab}</span>
            </>
          )}
        </button>
      </div>
      <PreBox title="Input" text={sample.input} />
      <PreBox title="Output" text={sample.output} />
    </div>
  );
}
