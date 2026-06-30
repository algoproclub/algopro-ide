import { Menu, Transition } from '@headlessui/react';
import {
  ChevronDownIcon,
  FolderIcon,
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  TrophyIcon,
  UserPlusIcon,
} from '@heroicons/react/20/solid';
import React, { Fragment, useState, useEffect } from 'react';
import classNames from 'classnames';
import ReactDOM from 'react-dom';
import { usePopper } from 'react-popper';
import { useNullableUserContext, isTeacher } from '../../context/UserContext';
import Link from 'next/link';

export const EditorNavigationMenu = (): JSX.Element => {
  const { userRole } = useNullableUserContext();

  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null
  );
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-start',
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdmin = userRole?.admin === true;
  const isTeacherUser = isTeacher(userRole);

  // Don't show if user is not a teacher or admin
  if (!isTeacherUser && !isAdmin) {
    return <></>;
  }

  const menuButtonClass = (open: boolean) =>
    `relative inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium text-[color:var(--text-primary)] focus:outline-none ${
      open
        ? 'bg-[var(--hover-bg)]'
        : 'hover:bg-[var(--hover-bg)] active:bg-[var(--hover-bg)]'
    }`;
  const menuPanelClass =
    'origin-top-left absolute z-10 left-0 w-56 shadow-lg bg-[var(--panel-bg)] border border-[var(--border-color)] focus:outline-none';
  const menuItemClass = (active: boolean) =>
    classNames(
      active
        ? 'bg-[var(--hover-bg)] text-[color:var(--text-primary)]'
        : 'text-[color:var(--text-primary)]',
      'group flex items-center px-4 py-2 text-sm'
    );
  const menuIconClass =
    'mr-3 h-5 w-5 text-[color:var(--text-secondary)] group-hover:text-[color:var(--text-primary)]';

  return (
    <Menu as="div" className="relative inline-block text-left">
      {({ open }) => (
        <>
          <div>
            <Menu.Button
              className={menuButtonClass(open)}
              ref={setReferenceElement}
            >
              Teacher
              <ChevronDownIcon
                className="ml-2 h-5 w-5 text-[color:var(--text-secondary)]"
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
                            {/* Teacher-only navigation */}
                            {isTeacherUser && (
                              <>
                                <Menu.Item>
                                  {({ active }) => (
                                    <Link
                                      href="/recent"
                                      className={menuItemClass(active)}
                                    >
                                      <ClockIcon
                                        className={menuIconClass}
                                        aria-hidden="true"
                                      />
                                      Recent Activity
                                    </Link>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <Link
                                      href="/teacher"
                                      className={menuItemClass(active)}
                                    >
                                      <AcademicCapIcon
                                        className={menuIconClass}
                                        aria-hidden="true"
                                      />
                                      Teacher Dashboard
                                    </Link>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <Link
                                      href="/groups"
                                      className={menuItemClass(active)}
                                    >
                                      <UserGroupIcon
                                        className={menuIconClass}
                                        aria-hidden="true"
                                      />
                                      Groups & Classes
                                    </Link>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <Link
                                      href="/invite"
                                      className={menuItemClass(active)}
                                    >
                                      <UserPlusIcon
                                        className={menuIconClass}
                                        aria-hidden="true"
                                      />
                                      Invite Students
                                    </Link>
                                  )}
                                </Menu.Item>
                              </>
                            )}

                            {/* Admin-only navigation */}
                            {isAdmin && (
                              <>
                                <div className="border-t border-[var(--border-color)] my-1" />
                                <Menu.Item>
                                  {({ active }) => (
                                    <Link
                                      href="/problems"
                                      className={menuItemClass(active)}
                                    >
                                      <FolderIcon
                                        className={menuIconClass}
                                        aria-hidden="true"
                                      />
                                      Problems
                                    </Link>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <Link
                                      href="/tournament/view"
                                      className={menuItemClass(active)}
                                    >
                                      <TrophyIcon
                                        className={menuIconClass}
                                        aria-hidden="true"
                                      />
                                      Tournament
                                    </Link>
                                  )}
                                </Menu.Item>
                                <Menu.Item>
                                  {({ active }) => (
                                    <Link
                                      href="/tournament/scoreboard"
                                      className={menuItemClass(active)}
                                    >
                                      <TrophyIcon
                                        className={menuIconClass}
                                        aria-hidden="true"
                                      />
                                      Scoreboard
                                    </Link>
                                  )}
                                </Menu.Item>
                              </>
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
