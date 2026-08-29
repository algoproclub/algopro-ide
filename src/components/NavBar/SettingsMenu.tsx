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
    modifiers: [{ name: 'offset', options: { offset: [0, 6] } }],
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!firebaseUser) {
    return null;
  }

  const menuItemClass = (active: boolean) =>
    classNames(
      active ? 'bg-surface-hover text-content' : 'text-content',
      'ui-menu-item group py-1.5'
    );
  const menuIconClass =
    'mr-2.5 h-4 w-4 text-content-muted group-hover:text-content';

  return (
    <Menu as="div" className="relative inline-block text-left">
      {({ open }) => (
        <>
          <div data-testid="settings-menu-button">
            <Menu.Button
              className={`ui-focus m-0.5 inline-flex h-8 items-center gap-1 rounded-md border px-1.5 text-sm font-medium transition-colors ${
                open
                  ? 'border-line-strong bg-surface-active'
                  : 'border-transparent hover:border-line hover:bg-surface-hover'
              }`}
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
                  className="h-6 w-6 text-content-secondary"
                  aria-hidden="true"
                />
              )}
              <ChevronDownIcon
                className="h-4 w-4 text-content-muted"
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
                        <div className="ui-menu absolute right-0 z-10 w-56 origin-top-right">
                          <div className="py-1">
                            <div className="px-4 py-2 text-sm text-content">
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
