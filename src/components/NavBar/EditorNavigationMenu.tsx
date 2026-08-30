import { Menu } from '@headlessui/react';
import {
  ChevronDownIcon,
  FolderIcon,
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  TrophyIcon,
  UserPlusIcon,
} from '@heroicons/react/20/solid';
import React, { useState } from 'react';
import { useNullableUserContext, isTeacher } from '../../context/UserContext';
import Link from 'next/link';
import {
  AnchoredMenuItems,
  anchoredMenuIconClass,
  getAnchoredMenuItemClass,
} from '../AnchoredMenuItems';

export const EditorNavigationMenu = (): JSX.Element => {
  const { userRole } = useNullableUserContext();

  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null
  );
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
              className={`workspace-toolbar-button ${
                open ? 'border-line-strong bg-surface-active' : ''
              }`}
              ref={setReferenceElement}
            >
              Teacher
              <ChevronDownIcon
                className="h-4 w-4 text-content-muted"
                aria-hidden="true"
              />
            </Menu.Button>
          </div>

          <AnchoredMenuItems
            anchor={referenceElement}
            className="w-56"
            menuClassName="origin-top-left"
            open={open}
            placement="bottom-start"
          >
            <div className="py-1">
              {/* Teacher-only navigation */}
              {isTeacherUser && (
                <>
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        href="/recent"
                        className={getAnchoredMenuItemClass(active)}
                      >
                        <ClockIcon
                          className={anchoredMenuIconClass}
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
                        className={getAnchoredMenuItemClass(active)}
                      >
                        <AcademicCapIcon
                          className={anchoredMenuIconClass}
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
                        className={getAnchoredMenuItemClass(active)}
                      >
                        <UserGroupIcon
                          className={anchoredMenuIconClass}
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
                        className={getAnchoredMenuItemClass(active)}
                      >
                        <UserPlusIcon
                          className={anchoredMenuIconClass}
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
                  <div className="my-1 border-t border-line" />
                  <Menu.Item>
                    {({ active }) => (
                      <Link
                        href="/problems"
                        className={getAnchoredMenuItemClass(active)}
                      >
                        <FolderIcon
                          className={anchoredMenuIconClass}
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
                        className={getAnchoredMenuItemClass(active)}
                      >
                        <TrophyIcon
                          className={anchoredMenuIconClass}
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
                        className={getAnchoredMenuItemClass(active)}
                      >
                        <TrophyIcon
                          className={anchoredMenuIconClass}
                          aria-hidden="true"
                        />
                        Scoreboard
                      </Link>
                    )}
                  </Menu.Item>
                </>
              )}
            </div>
          </AnchoredMenuItems>
        </>
      )}
    </Menu>
  );
};
