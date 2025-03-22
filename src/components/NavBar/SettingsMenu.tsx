import { Menu, Transition } from '@headlessui/react';
import {
  ChevronDownIcon,
  UserCircleIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/20/solid';
import React, { Fragment, useState, useEffect } from 'react';
import classNames from 'classnames';
import ReactDOM from 'react-dom';
import { usePopper } from 'react-popper';
import { useNullableUserContext } from '../../context/UserContext';
import { useSetAtom } from 'jotai';
import {
  signInWithGoogleAtom,
  signOutAtom,
} from '../../atoms/firebaseUserAtoms';
import { useConnectionContext } from '../../context/ConnectionContext';

export const SettingsMenu = (props: {
  setIsProfileSettingsOpen: (isOpen: boolean) => void;
}): JSX.Element => {
  const { firebaseUser } = useNullableUserContext();
  const signInWithGoogle = useSetAtom(signInWithGoogleAtom);
  const signOut = useSetAtom(signOutAtom);
  const connectionContext = useConnectionContext();

  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null
  );
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-end',
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Menu as="div" className="relative inline-block text-left">
      {({ open }) => (
        <>
          <div data-testid="settings-menu-button">
            <Menu.Button
              className={`relative inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium text-gray-200 focus:outline-none ${
                open ? 'bg-gray-800' : 'hover:bg-gray-800 active:bg-gray-700'
              }`}
              ref={setReferenceElement}
            >
              <UserCircleIcon
                className="h-6 w-6 text-gray-400"
                aria-hidden="true"
              />
              <ChevronDownIcon
                className="h-5 w-5 text-gray-400 ml-2"
                aria-hidden="true"
              />
            </Menu.Button>
          </div>

          <Transition show={open}>
            {mounted
              ? ReactDOM.createPortal(
                  <Menu.Items static as="div">
                    <div
                      ref={setPopperElement}
                      style={styles.popper}
                      {...attributes.popper}
                      className="relative"
                    >
                      <Transition.Child
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <div className="origin-top-right absolute z-10 right-0 w-56 shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none">
                          <div className="py-1">
                            {firebaseUser ? (
                              <>
                                <div className="px-4 py-2 text-sm text-gray-200">
                                  Signed in as{' '}
                                  <strong>{firebaseUser.displayName}</strong>
                                </div>
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      type="button"
                                      className={classNames(
                                        active
                                          ? 'bg-gray-700 text-gray-100'
                                          : 'text-gray-200',
                                        'group flex items-center px-4 py-2 text-sm w-full focus:outline-none'
                                      )}
                                      onClick={() =>
                                        props.setIsProfileSettingsOpen(true)
                                      }
                                    >
                                      <CogIcon
                                        className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300"
                                        aria-hidden="true"
                                      />
                                      Profile Settings
                                    </button>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <button
                                      type="button"
                                      className={classNames(
                                        active
                                          ? 'bg-gray-700 text-gray-100'
                                          : 'text-gray-200',
                                        'group flex items-center px-4 py-2 text-sm w-full focus:outline-none'
                                      )}
                                      onClick={() => signOut(connectionContext)}
                                    >
                                      <ArrowRightOnRectangleIcon
                                        className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300"
                                        aria-hidden="true"
                                      />
                                      Sign Out
                                    </button>
                                  )}
                                </Menu.Item>
                              </>
                            ) : (
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    type="button"
                                    className={classNames(
                                      active
                                        ? 'bg-gray-700 text-gray-100'
                                        : 'text-gray-200',
                                      'group flex items-center px-4 py-2 text-sm w-full focus:outline-none'
                                    )}
                                    onClick={() =>
                                      signInWithGoogle(connectionContext)
                                    }
                                  >
                                    <ArrowRightOnRectangleIcon
                                      className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300"
                                      aria-hidden="true"
                                    />
                                    Sign In
                                  </button>
                                )}
                              </Menu.Item>
                            )}
                          </div>
                        </div>
                      </Transition.Child>
                    </div>
                  </Menu.Items>,
                  document.body
                )
              : null}
          </Transition>
        </>
      )}
    </Menu>
  );
};
