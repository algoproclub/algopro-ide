import React from 'react';
import {
  CircleStackIcon as SolidCircleStackIcon,
  CodeBracketIcon as SolidCodeBracketIcon,
  UsersIcon as SolidUsersIcon,
} from '@heroicons/react/20/solid';
import {
  CircleStackIcon as OutlineCircleStackIcon,
  CodeBracketIcon as OutlineCodeBracketIcon,
  UsersIcon as OutlineUsersIcon,
} from '@heroicons/react/24/outline';

const MobileBottomNavButton = ({
  SolidIcon,
  OutlineIcon,
  label,
  isActive,
  onClick,
  dataTestId,
}: {
  SolidIcon: React.ComponentType<React.ComponentProps<'svg'>>;
  OutlineIcon: React.ComponentType<React.ComponentProps<'svg'>>;
  label: string;
  isActive: boolean;
  onClick: () => void;
  dataTestId?: string;
}) => {
  const Icon = isActive ? SolidIcon : OutlineIcon;

  return (
    <button
      className={`${
        isActive ? 'text-content' : 'text-content-secondary'
      } ui-focus flex flex-col items-center py-1 transition hover:text-content`}
      onClick={onClick}
      data-testid={dataTestId}
    >
      <Icon className="h-5 w-5" />
      <span className="text-sm">{label}</span>
    </button>
  );
};

export interface MobileBottomNavProps {
  activeTab: 'code' | 'io' | 'users';
  onActiveTabChange: (tab: 'code' | 'io' | 'users') => void;
}

export const MobileBottomNav = (props: MobileBottomNavProps): JSX.Element => {
  return (
    <div className="grid grid-cols-3 border-t border-line bg-panel-muted pt-2">
      <MobileBottomNavButton
        SolidIcon={SolidCodeBracketIcon}
        OutlineIcon={OutlineCodeBracketIcon}
        label="Code"
        isActive={props.activeTab === 'code'}
        onClick={() => props.onActiveTabChange('code')}
        dataTestId="mobile-bottom-nav-code-button"
      />
      <MobileBottomNavButton
        SolidIcon={SolidCircleStackIcon}
        OutlineIcon={OutlineCircleStackIcon}
        label="Input/Output"
        isActive={props.activeTab === 'io'}
        onClick={() => props.onActiveTabChange('io')}
      />
      <MobileBottomNavButton
        SolidIcon={SolidUsersIcon}
        OutlineIcon={OutlineUsersIcon}
        label="Users"
        isActive={props.activeTab === 'users'}
        onClick={() => props.onActiveTabChange('users')}
      />
    </div>
  );
};
