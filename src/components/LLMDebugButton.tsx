import React from 'react';
import { BugAntIcon } from '@heroicons/react/20/solid';
import LoadingIndicator from './LoadingIndicator';

export interface LLMDebugButtonProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  showLoading: boolean;
  disabledForNoProblem: boolean;
}

export const LLMDebugButton = ({
  onClick,
  showLoading,
  disabledForNoProblem,
}: LLMDebugButtonProps): JSX.Element => (
  <button
    type="button"
    data-test-id="llm-debug-button"
    className="ui-focus relative m-0.5 inline-flex h-8 min-w-[8rem] shrink-0 items-center whitespace-nowrap rounded-md border border-line bg-control px-3 text-sm font-semibold text-content shadow-sm transition-colors enabled:hover:border-line-strong enabled:hover:bg-surface-hover enabled:active:bg-surface-active disabled:cursor-not-allowed disabled:opacity-50"
    onClick={onClick}
    disabled={disabledForNoProblem || showLoading}
    title={
      disabledForNoProblem
        ? 'Debug with AI needs a linked problem'
        : 'Flag suspicious lines using AI'
    }
  >
    {showLoading ? (
      <LoadingIndicator
        className="h-4 w-4 p-0.5 text-content"
        data-test-id="llm-debug-loading"
      />
    ) : (
      <>
        <BugAntIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
        <span className="flex-1 text-center">Debug with AI</span>
      </>
    )}
  </button>
);
