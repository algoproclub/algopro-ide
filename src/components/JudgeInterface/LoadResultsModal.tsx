import React, { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEditorContext } from '../../context/EditorContext';
import { useUserContext } from '../../context/UserContext';
import { StatusData } from '../../types/problem';
import { registerSubmission } from '../../scripts/updateStatus';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAtomValue } from 'jotai';
import { mainEditorValueAtom } from '../../atoms/workspace';

const TextInput = ({
  text,
  id,
  label,
  onChange,
}: {
  text: string;
  id: string;
  label: string;
  onChange: (e: any) => void;
}) => {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[0.92rem] font-medium text-gray-700"
      >
        {label}
      </label>
      <div className="mt-1">
        <input
          type="text"
          name={id}
          id={id}
          className="mt-0 block w-full px-0 pt-0 pb-1 border-0 border-b-2 border-gray-200 focus:ring-0 focus:border-black text-sm"
          value={text}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

const CopyButton = () => {
  const getMainEditorValue = useAtomValue(mainEditorValueAtom);
  const [copied, setCopied] = useState(0);

  const handleCopyCode = () => {
    navigator.clipboard
      .writeText(getMainEditorValue ? getMainEditorValue() : '')
      .then(() => {
        setCopied(prevCopied => prevCopied + 1);
        setTimeout(() => {
          setCopied(prevCopied => prevCopied - 1);
        }, 5000);
      });
  };

  return (
    <button
      className="flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      onClick={handleCopyCode}
    >
      {copied === 0 && (
        <>
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'copy' }}
            className="mr-2"
          />
          Copy code
        </>
      )}
      {copied > 0 && (
        <>
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'check' }}
            className="mr-2"
          />
          Code copied
        </>
      )}
    </button>
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
  const needUsername = fileData?.problem?.platform === 'codeforces';

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
            <div className="inline-block bg-white md:rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl w-full">
              <div className="px-4 sm:px-6 pt-4 pb-2">
                <Dialog.Title
                  as="h3"
                  className="text-lg leading-6 font-medium text-gray-900 text-center"
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
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-[0.92rem] font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    onClick={confirmedClose}
                  >
                    Cancel
                  </button>
                  <CopyButton />
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
                  className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={confirmedClose}
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
