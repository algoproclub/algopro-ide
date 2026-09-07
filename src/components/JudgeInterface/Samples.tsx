import React from 'react';
import { PlayCircleIcon } from '@heroicons/react/20/solid';
import { Sample } from '../../types/problem';
import { useEditorContext } from '../../context/EditorContext';
import LoadingIndicator from '../LoadingIndicator';
import useUserPermission from '../../hooks/useUserPermission';
import classNames from 'classnames';
import useCodeRunActive from '../../hooks/useCodeRunActive';

export function getSampleIndex(inputTab: string): number {
  return inputTab.length === 6 ? 1 : +inputTab.substring(7);
}

export function getSampleTabId(sampleCount: number, index: number): string {
  return sampleCount === 1 ? 'Sample' : `Sample ${index + 1}`;
}

export const PreBox = ({
  title,
  text,
  roundedTop,
  roundedBottom,
}: {
  title: string;
  text: string;
  roundedTop?: boolean;
  roundedBottom?: boolean;
}) => {
  if (roundedTop === undefined) roundedTop = true;
  if (roundedBottom === undefined) roundedBottom = true;

  return (
    <div
      className={classNames(
        // overflow-x-hidden allows overflow-auto below to function properly
        'mx-0 flex flex-col overflow-x-hidden rounded-md border border-t-0 border-line bg-canvas text-content',
        roundedBottom ? '' : 'rounded-b-none',
        roundedTop ? '' : 'rounded-t-none'
      )}
    >
      <div
        className={classNames(
          'rounded-t-md border-b border-t border-line bg-panel-muted px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-content-secondary',
          roundedTop ? '' : 'rounded-t-none'
        )}
      >
        <span>{title}</span>
      </div>
      <div className="overflow-auto">
        <pre className="px-4 py-3 font-mono text-sm leading-6 tabular-nums">
          {text}
        </pre>
      </div>
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
  const { fileData } = useEditorContext();
  const index = getSampleIndex(inputTab);
  const sample = samples[index - 1];
  const permission = useUserPermission();
  const readOnly = !(permission === 'OWNER' || permission === 'READ_WRITE');
  const isCodeRunActive = useCodeRunActive(fileData.codeRun);

  return (
    <div className="relative h-full overflow-y-auto p-4 pb-0 text-sm">
      <div className="-mx-4 border-b border-line-muted px-4 pb-4">
        <button
          type="button"
          title={
            readOnly ? "You can't run code in a view-only document." : undefined
          }
          disabled={readOnly || isCodeRunActive}
          className="rounded-md relative flex-shrink-0 inline-flex items-center px-4 py-2.5 w-40 shadow-sm text-sm font-medium theme-button-primary focus:outline-none disabled:cursor-not-allowed"
          onClick={handleRunCode}
        >
          {isCodeRunActive ? (
            <>
              <LoadingIndicator className="h-5 w-5 p-0.5 mr-1.5" />
              <span className="flex-1 text-center">Running…</span>
            </>
          ) : (
            <>
              <PlayCircleIcon className="mr-2 h-5 w-5" aria-hidden="true" />
              <span className="text-center flex-1">Run {inputTab}</span>
            </>
          )}
        </button>
      </div>
      <div className="my-4 space-y-4">
        <PreBox title="Input" text={sample.input} />
        <PreBox title="Output" text={sample.output} />
      </div>
    </div>
  );
}
