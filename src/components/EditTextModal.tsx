import React, { Fragment, KeyboardEventHandler } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const EditTextModal = ({
  isOpen,
  title,
  text,
  onSave,
  onClose,
  children,
}: {
  isOpen: boolean;
  title: string;
  text: string;
  onSave: (text: string) => void;
  onClose: () => void;
  children: JSX.Element;
}) => {
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = event => {
    if (event.key === 'Tab') {
      event.preventDefault();

      const textarea = event.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      textarea.value =
        textarea.value.substring(0, start) +
        '\t' +
        textarea.value.substring(end);
      textarea.setSelectionRange(start + '\t'.length, start + '\t'.length);
    }
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
                  {title}
                </Dialog.Title>
              </div>
              <div className="p-4 sm:p-6 space-y-6">
                {children}
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
                      onSave(text);
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

export const EditTextAreaModal = ({
  isOpen,
  text,
  title,
  setText,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  text: string;
  title: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  onSave: (text: string) => void;
  onClose: () => void;
}) => {
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = event => {
    if (event.key === 'Tab') {
      event.preventDefault();

      const textarea = event.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      textarea.value =
        textarea.value.substring(0, start) +
        '\t' +
        textarea.value.substring(end);
      textarea.setSelectionRange(start + '\t'.length, start + '\t'.length);
    }
  };
  return (
    <EditTextModal
      isOpen={isOpen}
      title={title}
      text={text}
      onSave={onSave}
      onClose={onClose}
    >
      <textarea
        className="font-mono h-60 bg-gray-900 border-gray-700 w-full min-h-[10rem] text-sm"
        value={text}
        onKeyDown={handleKeyDown}
        onChange={e => setText(e.target.value)}
      />
    </EditTextModal>
  );
};

export const EditInlineTextModal = ({
  isOpen,
  text,
  title,
  setText,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  text: string;
  title: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  onSave: (text: string) => void;
  onClose: () => void;
}) => {
  return (
    <EditTextModal
      isOpen={isOpen}
      title={title}
      text={text}
      onSave={onSave}
      onClose={onClose}
    >
      <input
        className="border border-gray-700 w-full bg-gray-900 text-sm"
        type="text"
        value={text}
        onChange={e => {
          setText(e.target.value);
        }}
      />
    </EditTextModal>
  );
};
