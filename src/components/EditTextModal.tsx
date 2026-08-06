import React, {
  Fragment,
  useEffect,
  useState,
  KeyboardEventHandler,
} from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export type RenderEditor<T> = (
  value: T,
  setValue: React.Dispatch<React.SetStateAction<T>>
) => React.ReactNode;

export function EditModal<T>({
  isOpen,
  title,
  value,
  onSave,
  onClose,
  renderEditor,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
}: {
  isOpen: boolean;
  title: string;
  value: T;
  onSave: (value: T) => void;
  onClose: () => void;
  renderEditor: RenderEditor<T>;
  saveLabel?: string;
  cancelLabel?: string;
}) {
  const [draft, setDraft] = useState<T>(value);
  const saveDraft = () => onSave(draft);

  useEffect(() => {
    if (isOpen) setDraft(value);
  }, [isOpen, value]);

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
            <div className="inline-block w-full transform overflow-hidden border border-line bg-surface-raised text-left text-content shadow-xl transition-all md:rounded-lg sm:my-8 sm:max-w-2xl">
              <div className="px-4 sm:px-6 pt-4 pb-2">
                <Dialog.Title
                  as="h3"
                  className="text-lg leading-6 font-medium text-center"
                >
                  {title}
                </Dialog.Title>
              </div>

              <form
                className="space-y-6 p-4 sm:p-6"
                onSubmit={event => {
                  event.preventDefault();
                  saveDraft();
                }}
                onKeyDown={event => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    onClose();
                  }
                }}
              >
                <div>{renderEditor(draft, setDraft)}</div>

                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    className="ui-button-secondary px-4 py-2 text-[0.92rem]"
                    onClick={onClose}
                  >
                    {cancelLabel}
                  </button>
                  <button type="submit" className="ui-button-primary px-4 py-2">
                    {saveLabel}
                  </button>
                </div>
              </form>

              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="ui-icon-button text-content-muted hover:text-content"
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
}

export const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const textarea = e.target as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value =
      textarea.value.substring(0, start) + '\t' + textarea.value.substring(end);
    textarea.setSelectionRange(start + 1, start + 1);
  }
};

export function EditTextAreaModal({
  isOpen,
  title,
  text,
  setText,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  text: string;
  setText: (text: string) => void;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  return (
    <EditModal<string>
      isOpen={isOpen}
      title={title}
      value={text}
      onSave={onSave}
      onClose={onClose}
      renderEditor={(val, setVal) => (
        <textarea
          className="h-60 min-h-[10rem] w-full rounded-md border border-line bg-input p-3 font-mono text-sm text-content shadow-sm outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
          value={val}
          onKeyDown={handleKeyDown}
          onChange={e => {
            setVal(e.target.value);
            setText(e.target.value);
          }}
        />
      )}
    />
  );
}

export function EditInlineTextModal({
  isOpen,
  title,
  text,
  setText,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  text: string;
  setText: (text: string) => void;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  return (
    <EditModal<string>
      isOpen={isOpen}
      title={title}
      value={text}
      onSave={onSave}
      onClose={onClose}
      renderEditor={(val, setVal) => (
        <input
          className="w-full rounded-md border border-line bg-input px-3 py-2 text-sm text-content shadow-sm outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
          type="text"
          value={val}
          onChange={e => {
            setVal(e.target.value);
            setText(e.target.value);
          }}
        />
      )}
    />
  );
}

export type TwoFieldValue = {
  left: string;
  right: string;
};

export function EditGroupModal({
  isOpen,
  value,
  schoolID,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  value: TwoFieldValue;
  schoolID: string;
  onSave: (v: TwoFieldValue) => void;
  onClose: () => void;
}) {
  return (
    <EditModal<TwoFieldValue>
      isOpen={isOpen}
      title="Add new group"
      value={value}
      onSave={onSave}
      onClose={onClose}
      renderEditor={(val, setVal) => (
        <div className="space-y-3">
          <div className="flex flex-col space-y-1.5">
            <label className="text-sm text-content">Group ID</label>
            <div className="flex items-center gap-2">
              <span className="flex-none whitespace-nowrap text-sm text-content-muted">
                {schoolID}~
              </span>
              <input
                className="min-w-0 flex-1 rounded-md border border-line bg-input px-3 py-2 text-sm text-content shadow-sm outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
                value={val.left}
                onChange={e => setVal(v => ({ ...v, left: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-col space-y-1.5">
            <label className="text-sm text-content">Group name</label>
            <input
              className="w-full rounded-md border border-line bg-input px-3 py-2 text-sm text-content shadow-sm outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
              value={val.right}
              onChange={e => setVal(v => ({ ...v, right: e.target.value }))}
            />
          </div>
        </div>
      )}
    />
  );
}
