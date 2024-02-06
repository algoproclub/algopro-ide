import classNames from 'classnames';
import React from 'react';
import LoadingIndicator from '../LoadingIndicator';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function SubmitButton({
  isLoading,
  isDisabled,
  onClick,
}: {
  isLoading: boolean;
  isDisabled: boolean;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}): JSX.Element {
  const loadingClasses =
    'cursor-not-allowed bg-[#363636] bg-opacity-80 text-white opacity-80';
  const normalClasses =
    'text-white bg-[#363636] hover:bg-gray-600 hover:border-gray-500 active:bg-gray-500 active:border-gray-400';
  return (
    <button
      className={classNames(
        'block w-full py-2 text-lg font-medium transition focus:outline-none border-t border-gray-600 min-w-[24rem]',
        isLoading || isDisabled ? loadingClasses : normalClasses
      )}
      disabled={isLoading || isDisabled}
      onClick={onClick}
    >
      {isLoading ? (
        <>
          <LoadingIndicator className="h-5 w-5 p-0.5 mr-1.5" />
          <span>Waiting for results...</span>
        </>
      ) : isDisabled ? (
        <span>
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'ban' }}
            className="mr-2.5 w-4 h-4"
          />
          Cannot Submit
        </span>
      ) : (
        <>
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'paper-plane' }}
            className="mr-2.5 w-4 h-4"
          />
          <span>Submit</span>
        </>
      )}
    </button>
  );
}
