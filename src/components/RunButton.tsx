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
    className="relative whitespace-nowrap inline-flex items-center px-4 py-2 min-w-[8rem] shadow-sm text-sm font-medium text-white bg-[var(--accent)] enabled:hover:bg-[var(--accent-hover)] focus:bg-[var(--accent-hover)] focus:outline-none disabled:text-white/50 disabled:bg-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
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
        className="h-5 w-5 p-0.5 text-indigo-100"
        data-test-id="run-code-loading"
      />
    ) : (
      <>
        <PlayCircleIcon className="mr-1 h-5 w-5" aria-hidden="true" />
        <span className="text-center flex-1">Run Code</span>
      </>
    )}
  </button>
);
