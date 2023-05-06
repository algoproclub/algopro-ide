import classNames from 'classnames';
import React from 'react';
import LoadingIndicator from '../LoadingIndicator';

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
    'cursor-not-allowed bg-custom-blue bg-opacity-50 text-white opacity-50';
  const normalClasses =
    'text-white hover:text-indigo-100 hover:bg-custom-blue hover:bg-opacity-50 bg-custom-blue bg-opacity-50';
  return (
    <button
      className={classNames(
        'block w-full py-2 text-xl uppercase font-bold transition focus:outline-none',
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
        'Cannot Submit'
      ) : (
        'Submit'
      )}
    </button>
  );
}
