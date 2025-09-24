import React, { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEditorContext } from '../../context/EditorContext';
import { useUserContext } from '../../context/UserContext';
import { StatusData } from '../../types/problem';
import { registerSubmission } from '../../scripts/updateStatus';
import { useAtomValue } from 'jotai';
import { mainEditorValueAtom } from '../../atoms/workspace';
import { CopyButton } from '../CopyButton';

const TextInput = ({
  text,
  id,
  label,
  onChange,
}: {
  text: string;
  id: string;
  label: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) => {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[0.92rem] font-medium text-gray-300"
      >
        {label}
      </label>
      <div>
        <input
          type="text"
          name={id}
          id={id}
          className="text-input"
          value={text}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

const CopyCodeButton = () => {
  const getMainEditorValue = useAtomValue(mainEditorValueAtom);

  const handleCopyCode = () => {
    return navigator.clipboard.writeText(
      getMainEditorValue ? getMainEditorValue() : ''
    );
  };

  return (
    <CopyButton
      handleCopy={handleCopyCode}
      copiedLabel="Code copied"
      btnLabel="Copy code"
    />
  );
};

const LoadResultsModal = ({
  isOpen,
  onClose,
  setStatusData,
}: {
  isOpen: boolean;
  onClose: () => void;
  setStatusData: React.Dispatch<React.SetStateAction<StatusData | null>>;
}) => {
  const [submissionID, setSubmissionID] = useState<string>('');
  const [username, setUsername] = useState<string | null>(null);
  const { fileData } = useEditorContext();
  const { userData } = useUserContext();
  const needUsername = ['codeforces', 'spoj'].includes(
    fileData?.problem?.platform ?? ''
  );

  useEffect(() => {
    if (fileData?.problem?.platform) {
      setUsername(userData.usernames[fileData?.problem?.platform] ?? null);
    }
  }, [userData?.usernames, fileData?.problem?.platform]);

  const confirmedClose = () => {
    if (
      confirm(
        'If you exit, the results will not be loaded. Do you want to proceed?'
      )
    ) {
      onClose();
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        static
        className="fixed z-10 inset-0 overflow-y-auto"
        open={isOpen}
        onClose={confirmedClose}
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
                  Load results
                </Dialog.Title>
              </div>
              <div className="p-4 sm:p-6 space-y-6">
                {needUsername && (
                  <TextInput
                    label="Username"
                    text={username ?? ''}
                    id="username"
                    onChange={e => setUsername(e.target.value.trim())}
                  />
                )}
                <TextInput
                  label="Submission ID"
                  text={submissionID}
                  id="submissionID"
                  onChange={e => setSubmissionID(e.target.value.trim())}
                />
                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-700 shadow-sm text-[0.92rem] font-medium rounded-md text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onClick={confirmedClose}
                  >
                    Cancel
                  </button>
                  <CopyCodeButton />
                  <button
                    type="button"
                    className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    onClick={() => {
                      registerSubmission(
                        fileData.id,
                        submissionID,
                        username,
                        setStatusData
                      );
                      onClose();
                    }}
                  >
                    Load
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

export default LoadResultsModal;
