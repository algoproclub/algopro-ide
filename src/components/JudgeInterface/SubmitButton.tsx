import classNames from 'classnames';
import React, { Fragment, useEffect, useState } from 'react';
import LoadingIndicator from '../LoadingIndicator';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEditorContext } from '../../context/EditorContext';
import { get, getDatabase, ref, update } from 'firebase/database';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Checkbox from '../Checkbox';

const SolvedStatusModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { fileData } = useEditorContext();
  const [solvedInTheory, setSolvedInTheory] = useState<boolean | null>(null);
  const [alreadyKnew, setAlreadyKnew] = useState<boolean | null>(null);

  useEffect(() => {
    const setSolvedStatus = async () => {
      const solvedStatus = (
        await get(ref(getDatabase(), `files/${fileData.id}/solvedStatus`))
      ).val();
      setSolvedInTheory(solvedStatus?.solvedInTheory ?? false);
      setAlreadyKnew(solvedStatus?.alreadyKnew ?? false);
    };
    setSolvedStatus();
  }, []);

  const handleSave = () => {
    if (solvedInTheory === null || alreadyKnew === null) {
      return;
    }
    update(ref(getDatabase(), `files/${fileData.id}/solvedStatus`), {
      solvedInTheory,
      alreadyKnew,
    });
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        static
        className="fixed z-10 inset-0 overflow-y-auto"
        open={isOpen}
        onClose={onClose}
      >
        <div className="flex items-end justify-center min-h-full pt-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="inline-block bg-gray-800 border border-gray-700 text-white md:rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl w-full">
              <div className="px-4 sm:px-6 pt-4 pb-2">
                <Dialog.Title
                  as="h3"
                  className="text-lg leading-6 font-medium text-center"
                >
                  Status
                </Dialog.Title>
              </div>
              <div className="p-4 sm:p-6 space-y-6">
                <div className="space-y-1">
                  <Checkbox
                    checked={solvedInTheory ?? false}
                    label="Solved in theory"
                    toggleChecked={() => setSolvedInTheory(val => !val)}
                  />
                  <Checkbox
                    checked={alreadyKnew ?? false}
                    label="Already knew"
                    toggleChecked={() => setAlreadyKnew(val => !val)}
                  />
                </div>
                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-700 shadow-sm text-[0.92rem] font-medium rounded-md text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onClick={() => {
                      handleSave();
                      onClose();
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="rounded-md text-gray-200 hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onClick={onClose}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
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
    'cursor-not-allowed bg-opacity-80 text-white opacity-80';
  const normalClasses =
    'text-white bg-gray-800 border-x hover:bg-[#363636] active:bg-gray-700 active:border-gray-600';
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <SolvedStatusModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
      {!isLoading && !isDisabled && (
        <button
          className={`z-20 absolute -translate-y-1/2 top-1/2 right-2 p-1.5 rounded-full flex items-center justify-center hover:bg-[#363636] active:bg-gray-700`}
          onClick={() => setIsOpen(prevOpen => !prevOpen)}
        >
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'ellipsis-vertical' }}
            className={`w-3.5 h-3.5 inline text-gray-200 transition duration-200`}
          />
        </button>
      )}
      <button
        className={classNames(
          'relative z-10 border-x border-gray-700 bg-gray-800 flex items-center justify-left pl-4 sm:pl-6 w-full py-2 text-sm focus:outline-none min-w-[8rem] sm:min-w-[9rem]',
          isLoading || isDisabled ? loadingClasses : normalClasses
        )}
        disabled={isLoading || isDisabled}
        onClick={onClick}
      >
        {isLoading ? (
          <>
            <LoadingIndicator className="h-4 w-4 p-0.5 !mx-1.5" />
            <span>Waiting...</span>
          </>
        ) : isDisabled ? (
          <>
            <FontAwesomeIcon
              icon={{ prefix: 'fas', iconName: 'ban' }}
              className="mr-2.5 inline w-3.5 h-3.5"
            />
            Cannot Submit
          </>
        ) : (
          <>
            <FontAwesomeIcon
              icon={{ prefix: 'fas', iconName: 'paper-plane' }}
              className="mr-2.5 inline w-3.5 h-3.5"
            />
            <span>Submit</span>
          </>
        )}
      </button>
    </div>
  );
}
