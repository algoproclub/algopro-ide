import React from 'react';
import { BugAntIcon } from '@heroicons/react/20/solid';
import LoadingIndicator from './LoadingIndicator';
import { debugClientConfig } from '../debug/debugClientConfig';

export interface DebugButtonProps {
  onClick:
    | ((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void)
    | undefined;
  showLoading: boolean;
  disabledForViewOnly: boolean;
}

export const DebugButton = ({
  onClick,
  showLoading,
  disabledForViewOnly,
}: DebugButtonProps): JSX.Element => (
  <button
    type="button"
    data-test-id="debug-code-button"
    className="relative whitespace-nowrap inline-flex items-center px-4 py-2 min-w-[8rem] shadow-sm text-sm font-medium text-white bg-emerald-900 enabled:hover:bg-emerald-800 focus:bg-emerald-800 focus:outline-none disabled:text-emerald-300/50 disabled:bg-emerald-900/50 disabled:cursor-not-allowed"
    onClick={onClick}
    disabled={disabledForViewOnly || showLoading}
    title={
      disabledForViewOnly
        ? 'Debug cannot be run in a view-only document'
        : 'Flag suspicious lines using AI'
    }
  >
    {showLoading ? (
      <LoadingIndicator
        className="h-5 w-5 p-0.5 text-emerald-100"
        data-test-id="debug-code-loading"
      />
    ) : (
      <>
        <BugAntIcon className="mr-1 h-5 w-5" aria-hidden="true" />
        <span className="text-center flex-1">
          {debugClientConfig.buttonLabel}
        </span>
      </>
    )}
  </button>
);
