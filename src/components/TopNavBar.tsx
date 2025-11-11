import Link from 'next/link';
import { useRouter } from 'next/router';
import { useNullableUserContext, isTeacher } from '../context/UserContext';
import {
  HomeIcon,
  FolderIcon,
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  TrophyIcon,
  UserPlusIcon,
  PlusIcon,
} from '@heroicons/react/20/solid';
import { SettingsMenu } from './NavBar/SettingsMenu';
import ProfileSettings from './settings/ProfileSettings';
import { useState } from 'react';

export const TopNavBar = (): JSX.Element => {
  const router = useRouter();
  const { userRole, userData, registered } = useNullableUserContext();
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);

  // Don't show on editor pages (they have their own NavBar)
  const isEditorPage =
    router.pathname === '/[id]' ||
    router.pathname === '/[id]/copy' ||
    router.pathname.startsWith('/solve/');

  if (isEditorPage) {
    return <></>;
  }

  const isAdmin = userRole?.admin === true;
  const isTeacherUser = isTeacher(userRole);

  const navItemClass =
    'px-3 py-2 text-sm font-medium rounded-md transition-colors';

  return (
    <nav className="bg-gray-900 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <Link
              href="/"
              className="flex items-center px-3 py-2 text-base font-semibold text-gray-200 hover:text-white"
            >
              AlgoPro IDE
            </Link>

            <div className="hidden md:flex items-center space-x-1 ml-8">
              <Link
                href="/"
                className={`${navItemClass} ${
                  router.pathname === '/'
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <div className="flex items-center">
                  <HomeIcon className="h-4 w-4 mr-1.5" />
                  Home
                </div>
              </Link>

              {userData && registered && (
                <Link
                  href="/new"
                  className={`${navItemClass} ${
                    router.pathname === '/new'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center">
                    <PlusIcon className="h-4 w-4 mr-1.5" />
                    New File
                  </div>
                </Link>
              )}

              {isTeacherUser && (
                <>
                  <Link
                    href="/recent"
                    className={`${navItemClass} ${
                      router.pathname === '/recent'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-1.5" />
                      Recent
                    </div>
                  </Link>
                  <Link
                    href="/teacher"
                    className={`${navItemClass} ${
                      router.pathname === '/teacher'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <AcademicCapIcon className="h-4 w-4 mr-1.5" />
                      Dashboard
                    </div>
                  </Link>
                  <Link
                    href="/groups"
                    className={`${navItemClass} ${
                      router.pathname.startsWith('/groups')
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <UserGroupIcon className="h-4 w-4 mr-1.5" />
                      Groups
                    </div>
                  </Link>
                  <Link
                    href="/invite"
                    className={`${navItemClass} ${
                      router.pathname === '/invite'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <UserPlusIcon className="h-4 w-4 mr-1.5" />
                      Invite
                    </div>
                  </Link>
                </>
              )}

              {isAdmin && (
                <>
                  <Link
                    href="/problems"
                    className={`${navItemClass} ${
                      router.pathname === '/problems'
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <FolderIcon className="h-4 w-4 mr-1.5" />
                      Problems
                    </div>
                  </Link>
                  <Link
                    href="/tournament/view"
                    className={`${navItemClass} ${
                      router.pathname.startsWith('/tournament')
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center">
                      <TrophyIcon className="h-4 w-4 mr-1.5" />
                      Tournament
                    </div>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Profile/Settings Menu */}
          <div className="flex items-center">
            <SettingsMenu setIsProfileSettingsOpen={setIsProfileSettingsOpen} />
          </div>
        </div>
      </div>
      <ProfileSettings
        isOpen={isProfileSettingsOpen}
        onClose={() => setIsProfileSettingsOpen(false)}
      />
    </nav>
  );
};
