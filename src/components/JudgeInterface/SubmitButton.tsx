import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import LoadingIndicator from '../LoadingIndicator';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEditorContext } from '../../context/EditorContext';
import { getDatabase, ref, update } from 'firebase/database';

const SolvedStatusForm = () => {
  const { fileData } = useEditorContext();
  const [isOpen, setIsOpen] = useState(false);
  const [solvedInTheory, setSolvedInTheory] = useState(false);
  const [alreadyKnew, setAlreadyKnew] = useState(false);

  useEffect(() => {
    update(ref(getDatabase(), `files/${fileData.id}/solvedStatus`), {
      solvedInTheory,
      alreadyKnew,
    });
  }, [solvedInTheory, alreadyKnew]);

  const solvedInTheoryChanged = () => {
    setSolvedInTheory(val => !val);
  };
  const alreadyKnewChanged = () => {
    setAlreadyKnew(val => !val);
  };

  return (
    <div>
      <div
        className={`z-0 absolute bottom-full w-full flex items-center px-4 py-4 bg-gray-800 border-t border-gray-600 overflow-x-auto space-x-6 whitespace-nowrap ${
          isOpen ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        } duration-200`}
      >
        <label className="text-[0.85rem] text-white flex items-center">
          <input
            checked={solvedInTheory}
            onChange={solvedInTheoryChanged}
            type="checkbox"
            className="w-4 h-4 bg-gray-900 checked:bg-indigo-500 checked:focus:bg-indigo-500 checked:focus:hover:bg-indigo-600 checked:hover:bg-indigo-600 accent-indigo-500 focus:ring-0 focus:ring-offset-0"
          />
          <span className="ml-2 mb-0.5">Solved in theory</span>
        </label>
        <label className="text-[0.85rem] text-white flex items-center">
          <input
            checked={alreadyKnew}
            onChange={alreadyKnewChanged}
            type="checkbox"
            className="w-4 h-4 bg-gray-900 checked:bg-indigo-500 checked:focus:bg-indigo-500 checked:focus:hover:bg-indigo-600 checked:hover:bg-indigo-600 accent-indigo-500 focus:ring-0 focus:ring-offset-0"
          />
          <span className="ml-2 mb-0.5">Already knew</span>
        </label>
      </div>
      <button
        className={`z-20 absolute -translate-y-1/2 top-1/2 right-2 p-2.5 rounded-full flex items-center justify-center hover:bg-gray-600 active:bg-gray-500`}
        onClick={() => setIsOpen(prevOpen => !prevOpen)}
      >
        <FontAwesomeIcon
          icon={{ prefix: 'fas', iconName: 'chevron-up' }}
          className={`${
            isOpen ? 'rotate-180' : 'rotate-0'
          } text-white transition duration-200`}
        />
      </button>
    </div>
  );
};

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
    <div className="relative z-0">
      {!isLoading && !isDisabled && <SolvedStatusForm />}
      <button
        className={classNames(
          'relative z-10 block w-full py-2.5 font-medium focus:outline-none border-t border-gray-600 min-w-[24rem]',
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
    </div>
  );
}
