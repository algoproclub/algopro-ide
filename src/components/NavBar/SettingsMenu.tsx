import { Menu } from '@headlessui/react';
import {
  ChevronDownIcon,
  UserCircleIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/20/solid';
import React, { useState } from 'react';
import { useNullableUserContext } from '../../context/UserContext';
import { useSetAtom } from 'jotai';
import { signOutAtom } from '../../atoms/firebaseUserAtoms';
import { useConnectionContext } from '../../context/ConnectionContext';
import {
  AnchoredMenuItems,
  anchoredMenuIconClass,
  getAnchoredMenuItemClass,
} from '../AnchoredMenuItems';

export const SettingsMenu = (props: {
  setIsProfileSettingsOpen: (isOpen: boolean) => void;
}): JSX.Element | null => {
  const { firebaseUser } = useNullableUserContext();
  const signOut = useSetAtom(signOutAtom);
  const connectionContext = useConnectionContext();

  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null
  );
  if (!firebaseUser) {
    return null;
  }

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

          <AnchoredMenuItems
            anchor={referenceElement}
            className="w-56"
            menuClassName="origin-top-right"
            open={open}
            placement="bottom-end"
          >
            <div className="py-1">
              <div className="px-4 py-2 text-sm text-content">
                Signed in as <strong>{firebaseUser.displayName}</strong>
              </div>
              <Menu.Item>
                {({ active }) => (
                  <button
                    type="button"
                    className={getAnchoredMenuItemClass(active)}
                    onClick={() => props.setIsProfileSettingsOpen(true)}
                  >
                    <CogIcon
                      className={anchoredMenuIconClass}
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
                    className={getAnchoredMenuItemClass(active)}
                    onClick={() => signOut(connectionContext)}
                  >
                    <ArrowRightOnRectangleIcon
                      className={anchoredMenuIconClass}
                      aria-hidden="true"
                    />
                    Sign Out
                  </button>
                )}
              </Menu.Item>
            </div>
          </AnchoredMenuItems>
        </>
      )}
    </Menu>
  );
};
