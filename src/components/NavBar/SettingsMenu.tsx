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
import { signOutAtom } from '../../atoms/firebaseUserAtoms';
import { useConnectionContext } from '../../context/ConnectionContext';

export const SettingsMenu = (props: {
  setIsProfileSettingsOpen: (isOpen: boolean) => void;
}): JSX.Element | null => {
  const { firebaseUser } = useNullableUserContext();
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

  if (!firebaseUser) {
    return null;
  }

  const menuButtonClass = (open: boolean) =>
    `relative inline-flex items-center px-4 py-1.5 shadow-sm text-sm font-medium text-[color:var(--text-primary)] focus:outline-none ${
      open ? 'bg-[var(--hover-bg)]' : 'hover:bg-[var(--hover-bg)] active:bg-[var(--hover-bg)]'
    }`;
  const menuPanelClass =
    'origin-top-right absolute z-10 right-0 w-56 shadow-lg bg-[var(--panel-bg)] border border-[var(--border-color)] focus:outline-none';
  const menuItemClass = (active: boolean) =>
    classNames(
      active
        ? 'bg-[var(--hover-bg)] text-[color:var(--text-primary)]'
        : 'text-[color:var(--text-primary)]',
      'group flex items-center px-4 py-2 text-sm w-full focus:outline-none'
    );
  const menuIconClass =
    'mr-3 h-5 w-5 text-[color:var(--text-secondary)] group-hover:text-[color:var(--text-primary)]';

  return (
    <Menu as="div" className="relative inline-block text-left">
      {({ open }) => (
        <>
          <div data-testid="settings-menu-button">
            <Menu.Button
              className={menuButtonClass(open)}
              ref={setReferenceElement}
            >
              {firebaseUser?.photoURL ? (
                <img
                  className="h-6 w-6 rounded-full object-cover"
                  src={firebaseUser.photoURL}
                  alt=""
                />
              ) : (
                <UserCircleIcon
                  className="h-6 w-6 text-[color:var(--text-secondary)]"
                  aria-hidden="true"
                />
              )}
              <ChevronDownIcon
                className="h-5 w-5 text-[color:var(--text-secondary)] ml-2"
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
                        <div className={menuPanelClass}>
                          <div className="py-1">
                            <div className="px-4 py-2 text-sm text-[color:var(--text-primary)]">
                              Signed in as{' '}
                              <strong>{firebaseUser.displayName}</strong>
                            </div>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  type="button"
                                  className={menuItemClass(active)}
                                  onClick={() =>
                                    props.setIsProfileSettingsOpen(true)
                                  }
                                >
                                  <CogIcon
                                    className={menuIconClass}
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
                                  className={menuItemClass(active)}
                                  onClick={() => signOut(connectionContext)}
                                >
                                  <ArrowRightOnRectangleIcon
                                    className={menuIconClass}
                                    aria-hidden="true"
                                  />
                                  Sign Out
                                </button>
                              )}
                            </Menu.Item>
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
