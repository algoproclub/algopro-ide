import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

export default function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        static
        className="fixed inset-0 z-50 overflow-y-auto"
        open={isOpen}
        onClose={onClose}
      >
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-75" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-2 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-2 sm:scale-95"
          >
            <div className="relative w-full max-w-md transform rounded-lg border border-line bg-surface-raised p-5 text-left text-content shadow-xl transition-all">
              <Dialog.Title as="h2" className="text-base font-semibold">
                {title}
              </Dialog.Title>
              <p className="mt-2 text-sm text-content-muted">{description}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  autoFocus
                  type="button"
                  className="ui-button-secondary py-2"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ui-button border-transparent bg-danger py-2 text-content-inverted enabled:hover:bg-status-danger"
                  onClick={onConfirm}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
