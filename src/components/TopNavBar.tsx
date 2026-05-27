import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  useNullableUserContext,
  isTeacher,
  type UserData,
} from '../context/UserContext';
import {
  HomeIcon,
  FolderIcon,
  ClockIcon,
  UserGroupIcon,
  AcademicCapIcon,
  TrophyIcon,
  UserPlusIcon,
  PlusIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/20/solid';
import { SettingsMenu } from './NavBar/SettingsMenu';
import ProfileSettings from './settings/ProfileSettings';
import React, { useState } from 'react';

interface NavLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  className: string;
  onNavigate?: () => void;
}

const NavLink = ({
  href,
  icon: Icon,
  label,
  isActive,
  className,
  onNavigate,
}: NavLinkProps) => (
  <Link
    href={href}
    className={`${className} ${
      isActive
        ? 'bg-[color:var(--surface-active)] text-[color:var(--text-primary)]'
        : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]'
    }`}
    onClick={onNavigate}
  >
    <div className="flex items-center">
      <Icon className="h-4 w-4 mr-1.5" />
      {label}
    </div>
  </Link>
);

interface NavLinksProps {
  router: ReturnType<typeof useRouter>;
  userData: UserData | null;
  registered: boolean | null;
  isTeacherUser: boolean;
  isAdmin: boolean;
  className: string;
  onNavigate?: () => void;
}

const NavLinks = ({
  router,
  userData,
  registered,
  isTeacherUser,
  isAdmin,
  className,
  onNavigate,
}: NavLinksProps) => (
  <>
    <NavLink
      href="/"
      icon={HomeIcon}
      label="Home"
      isActive={router.pathname === '/'}
      className={className}
      onNavigate={onNavigate}
    />

    {userData && registered && (
      <NavLink
        href="/new"
        icon={PlusIcon}
        label="New File"
        isActive={router.pathname === '/new'}
        className={className}
        onNavigate={onNavigate}
      />
    )}

    {isTeacherUser && (
      <>
        <NavLink
          href="/recent"
          icon={ClockIcon}
          label="Recent"
          isActive={router.pathname === '/recent'}
          className={className}
          onNavigate={onNavigate}
        />
        <NavLink
          href="/teacher"
          icon={AcademicCapIcon}
          label="Dashboard"
          isActive={router.pathname === '/teacher'}
          className={className}
          onNavigate={onNavigate}
        />
        <NavLink
          href="/groups"
          icon={UserGroupIcon}
          label="Groups"
          isActive={router.pathname.startsWith('/groups')}
          className={className}
          onNavigate={onNavigate}
        />
        <NavLink
          href="/invite"
          icon={UserPlusIcon}
          label="Invite"
          isActive={router.pathname === '/invite'}
          className={className}
          onNavigate={onNavigate}
        />
      </>
    )}

    {isAdmin && (
      <>
        <NavLink
          href="/problems"
          icon={FolderIcon}
          label="Problems"
          isActive={router.pathname === '/problems'}
          className={className}
          onNavigate={onNavigate}
        />
        <NavLink
          href="/tournament/view"
          icon={TrophyIcon}
          label="Tournament"
          isActive={router.pathname.startsWith('/tournament')}
          className={className}
          onNavigate={onNavigate}
        />
      </>
    )}
  </>
);

export const TopNavBar = (): JSX.Element => {
  const router = useRouter();
  const { userRole, userData, registered } = useNullableUserContext();
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  const mobileNavItemClass =
    'block px-3 py-2 text-base font-medium rounded-md transition-colors';

  return (
    <nav className="theme-surface-muted border-b theme-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <Link
              href="/"
              // szda re-theme phase2: top-level nav shell follows semantic theme tokens.
              className="flex items-center px-3 py-2 text-base font-semibold theme-text hover:text-[color:var(--accent-hover)] whitespace-nowrap"
            >
              AlgoPro IDE
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden xl:flex items-center space-x-1 ml-8 flex-shrink-0">
              <NavLinks
                router={router}
                userData={userData}
                registered={registered}
                isTeacherUser={isTeacherUser}
                isAdmin={isAdmin}
                className={navItemClass}
              />
            </div>
          </div>

          {/* Profile/Settings Menu */}
          <div className="flex items-center space-x-2">
            {/* Mobile menu button */}
            <button
              type="button"
              className="xl:hidden inline-flex items-center justify-center p-2 rounded-md text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[color:var(--accent)]"
              aria-controls="mobile-menu"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
            <SettingsMenu setIsProfileSettingsOpen={setIsProfileSettingsOpen} />
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="xl:hidden border-t theme-border theme-surface">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <NavLinks
              router={router}
              userData={userData}
              registered={registered}
              isTeacherUser={isTeacherUser}
              isAdmin={isAdmin}
              className={mobileNavItemClass}
              onNavigate={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      <ProfileSettings
        isOpen={isProfileSettingsOpen}
        onClose={() => setIsProfileSettingsOpen(false)}
      />
    </nav>
  );
};
