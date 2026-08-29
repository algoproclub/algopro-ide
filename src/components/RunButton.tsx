import React from 'react';
import { PlayCircleIcon } from '@heroicons/react/20/solid';
import LoadingIndicator from './LoadingIndicator';

export interface RunButtonProps {
  onClick:
    | ((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void)
    | undefined;
  showLoading: boolean;
  disabledForViewOnly: boolean;
}

export const RunButton = ({
  onClick,
  showLoading,
  disabledForViewOnly,
}: RunButtonProps): JSX.Element => (
  <button
    type="button"
    className="ui-focus relative m-0.5 inline-flex h-8 min-w-[7rem] items-center whitespace-nowrap rounded-md bg-accent px-3 text-sm font-semibold text-white shadow-sm transition-colors enabled:hover:bg-accent-strong enabled:active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
    onClick={onClick}
    disabled={disabledForViewOnly || showLoading}
    title={
      disabledForViewOnly
        ? "You can't run code in a view-only document."
        : undefined
    }
  >
    {showLoading ? (
      <LoadingIndicator
        className="h-4 w-4 p-0.5 text-white"
        data-test-id="run-code-loading"
      />
    ) : (
      <>
        <PlayCircleIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
        <span className="text-center flex-1">Run Code</span>
      </>
    )}
  </button>
);
