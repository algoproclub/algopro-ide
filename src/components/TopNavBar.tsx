import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  useNullableUserContext,
  isTeacher,
  type UserData,
} from '../context/UserContext';
import * as SolidIcons from '@heroicons/react/24/solid';
import * as OutlineIcons from '@heroicons/react/24/outline';
import { SettingsMenu } from './NavBar/SettingsMenu';
import ProfileSettings from './settings/ProfileSettings';
import React, { useState } from 'react';
import Logo from './Logo';

const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'AlgoPro IDE';

const navigationIcons = {
  Home: [OutlineIcons.HomeIcon, SolidIcons.HomeIcon],
  'New File': [OutlineIcons.PlusIcon, SolidIcons.PlusIcon],
  Recent: [OutlineIcons.ClockIcon, SolidIcons.ClockIcon],
  Dashboard: [OutlineIcons.AcademicCapIcon, SolidIcons.AcademicCapIcon],
  Groups: [OutlineIcons.UserGroupIcon, SolidIcons.UserGroupIcon],
  Invite: [OutlineIcons.UserPlusIcon, SolidIcons.UserPlusIcon],
  Problems: [OutlineIcons.FolderIcon, SolidIcons.FolderIcon],
  Tournament: [OutlineIcons.TrophyIcon, SolidIcons.TrophyIcon],
} as const;

interface NavLinkProps {
  href: string;
  label: keyof typeof navigationIcons;
  isActive: boolean;
  className: string;
  onNavigate?: () => void;
}

const NavLink = ({
  href,
  label,
  isActive,
  className,
  onNavigate,
}: NavLinkProps) => {
  const [OutlineIcon, SolidIcon] = navigationIcons[label];
  const Icon = isActive ? SolidIcon : OutlineIcon;

  return (
    <Link
      href={href}
      className={`${className} ${
        isActive
          ? 'bg-surface text-content'
          : 'text-content-secondary hover:bg-surface-hover hover:text-content'
      }`}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
    >
      <div className="flex items-center">
        <Icon className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {label}
      </div>
    </Link>
  );
};

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
      label="Home"
      isActive={router.pathname === '/'}
      className={className}
      onNavigate={onNavigate}
    />

    {userData && registered && (
      <NavLink
        href="/new"
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
          label="Recent"
          isActive={router.pathname === '/recent'}
          className={className}
          onNavigate={onNavigate}
        />
        <NavLink
          href="/teacher"
          label="Dashboard"
          isActive={router.pathname === '/teacher'}
          className={className}
          onNavigate={onNavigate}
        />
        <NavLink
          href="/groups"
          label="Groups"
          isActive={router.pathname.startsWith('/groups')}
          className={className}
          onNavigate={onNavigate}
        />
        <NavLink
          href="/invite"
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
          label="Problems"
          isActive={router.pathname === '/problems'}
          className={className}
          onNavigate={onNavigate}
        />
        <NavLink
          href="/tournament/view"
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

  return (
    <nav className="border-b border-line bg-surface-muted text-content">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center space-x-2">
            <Link
              href="/"
              className="flex items-center whitespace-nowrap px-3 py-2 text-base font-semibold hover:text-accent-hover theme-text"
            >
              <Logo className="mr-2 h-7 w-7 object-contain" />
              {productName}
            </Link>

            {/* Desktop Navigation */}
            <div className="ml-8 hidden flex-shrink-0 items-center space-x-1 xl:flex">
              <NavLinks
                router={router}
                userData={userData}
                registered={registered}
                isTeacherUser={isTeacherUser}
                isAdmin={isAdmin}
                className="rounded-md px-3 py-2 text-sm font-medium transition-colors"
              />
            </div>
          </div>

          {/* Profile/Settings Menu */}
          <div className="flex items-center space-x-2">
            {/* Mobile menu button */}
            <button
              type="button"
              className="ui-focus inline-flex items-center justify-center rounded-md p-2 text-content-secondary hover:bg-surface-hover hover:text-content xl:hidden"
              aria-controls="mobile-menu"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <SolidIcons.XMarkIcon
                  className="block h-6 w-6"
                  aria-hidden="true"
                />
              ) : (
                <SolidIcons.Bars3Icon
                  className="block h-6 w-6"
                  aria-hidden="true"
                />
              )}
            </button>
            <SettingsMenu setIsProfileSettingsOpen={setIsProfileSettingsOpen} />
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="border-t theme-border theme-surface xl:hidden">
          <div className="space-y-1 px-2 pb-3 pt-2">
            <NavLinks
              router={router}
              userData={userData}
              registered={registered}
              isTeacherUser={isTeacherUser}
              isAdmin={isAdmin}
              className="block rounded-md px-3 py-2 text-base font-medium transition-colors"
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
