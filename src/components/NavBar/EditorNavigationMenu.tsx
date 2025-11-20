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

  return (
    <Menu as="div" className="relative inline-block text-left">
      {({ open }) => (
        <>
          <div>
            <Menu.Button
              className={`relative inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium text-gray-200 focus:outline-none ${
                open ? 'bg-gray-800' : 'hover:bg-gray-800 active:bg-gray-700'
              }`}
              ref={setReferenceElement}
            >
              Teacher
              <ChevronDownIcon
                className="ml-2 h-5 w-5 text-gray-400"
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
                        <div className="origin-top-left absolute z-10 left-0 w-56 shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none">
                          <div className="py-1">
                            {/* Teacher-only navigation */}
                            {isTeacherUser && (
                              <>
                                <Menu.Item>
                                  {({ active }) => (
                                    <Link
                                      href="/recent"
                                      className={classNames(
                                        active
                                          ? 'bg-gray-700 text-gray-100'
                                          : 'text-gray-200',
                                        'group flex items-center px-4 py-2 text-sm'
                                      )}
                                    >
                                      <ClockIcon
                                        className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300"
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
                                      className={classNames(
                                        active
                                          ? 'bg-gray-700 text-gray-100'
                                          : 'text-gray-200',
                                        'group flex items-center px-4 py-2 text-sm'
                                      )}
                                    >
                                      <AcademicCapIcon
                                        className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300"
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
                                      className={classNames(
                                        active
                                          ? 'bg-gray-700 text-gray-100'
                                          : 'text-gray-200',
                                        'group flex items-center px-4 py-2 text-sm'
                                      )}
                                    >
                                      <UserGroupIcon
                                        className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300"
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
                                      className={classNames(
                                        active
                                          ? 'bg-gray-700 text-gray-100'
                                          : 'text-gray-200',
                                        'group flex items-center px-4 py-2 text-sm'
                                      )}
                                    >
                                      <UserPlusIcon
                                        className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300"
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
                                <div className="border-t border-gray-700 my-1" />
                                <Menu.Item>
                                  {({ active }) => (
                                    <Link
                                      href="/problems"
                                      className={classNames(
                                        active
                                          ? 'bg-gray-700 text-gray-100'
                                          : 'text-gray-200',
                                        'group flex items-center px-4 py-2 text-sm'
                                      )}
                                    >
                                      <FolderIcon
                                        className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300"
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
                                      className={classNames(
                                        active
                                          ? 'bg-gray-700 text-gray-100'
                                          : 'text-gray-200',
                                        'group flex items-center px-4 py-2 text-sm'
                                      )}
                                    >
                                      <TrophyIcon
                                        className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300"
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
                                      className={classNames(
                                        active
                                          ? 'bg-gray-700 text-gray-100'
                                          : 'text-gray-200',
                                        'group flex items-center px-4 py-2 text-sm'
                                      )}
                                    >
                                      <TrophyIcon
                                        className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-300"
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
