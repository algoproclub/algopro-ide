import React, { Fragment, useEffect, useState } from 'react';
import LoadingIndicator from '../LoadingIndicator';
import { useEditorContext } from '../../context/EditorContext';
import { get, getDatabase, ref, update } from 'firebase/database';
import { Dialog, Transition } from '@headlessui/react';
import {
  ArrowUpTrayIcon,
  EllipsisVerticalIcon,
  NoSymbolIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
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
            <div className="inline-block theme-surface-raised border theme-border md:rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl w-full">
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
                    className="ui-button-secondary px-4 py-2 text-[0.92rem]"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ui-button-primary px-4 py-2"
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
                  className="ui-icon-button"
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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <SolvedStatusModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
      {!isLoading && !isDisabled && (
        <button
          aria-label="Submission options"
          className="ui-focus absolute right-0.5 top-1/2 z-20 flex h-7 w-8 -translate-y-1/2 items-center justify-center rounded-r border-l border-line-strong text-content-muted hover:bg-surface-hover hover:text-content active:bg-surface-active"
          onClick={() => setIsOpen(prevOpen => !prevOpen)}
        >
          <EllipsisVerticalIcon className="h-4 w-4" />
        </button>
      )}
      <button
        className="ui-focus relative z-10 m-0.5 flex h-8 min-w-[7.5rem] items-center justify-start rounded-md border border-line-strong bg-surface-active pl-3 pr-10 text-sm font-semibold text-content shadow-sm transition-colors hover:bg-surface-hover active:bg-surface-active disabled:cursor-not-allowed disabled:text-content-disabled disabled:opacity-80 sm:min-w-[8.5rem]"
        disabled={isLoading || isDisabled}
        onClick={onClick}
      >
        {isLoading ? (
          <>
            <LoadingIndicator className="h-4 w-4 p-0.5 !mx-1.5" />
            <span>Waiting…</span>
          </>
        ) : isDisabled ? (
          <>
            <NoSymbolIcon className="mr-2 h-4 w-4" />
            Cannot Submit
          </>
        ) : (
          <>
            <ArrowUpTrayIcon className="mr-2 h-4 w-4" />
            <span>Submit</span>
          </>
        )}
      </button>
    </div>
  );
}
