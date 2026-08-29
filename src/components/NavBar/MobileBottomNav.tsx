import React from 'react';
import {
  CodeBracketIcon,
  CircleStackIcon,
  UsersIcon,
} from '@heroicons/react/20/solid';

const MobileBottomNavButton = ({
  IconComponent,
  label,
  isActive,
  onClick,
  dataTestId,
}: {
  IconComponent: React.ComponentType<React.ComponentProps<'svg'>>;
  label: string;
  isActive: boolean;
  onClick: () => void;
  dataTestId?: string;
}) => (
  <button
    className={`${
      isActive ? 'text-content' : 'text-content-secondary'
    } ui-focus flex flex-col items-center py-1 transition hover:text-content`}
    onClick={() => onClick()}
    data-testid={dataTestId}
  >
    <IconComponent className="h-5 w-5" />
    <span className="text-sm">{label}</span>
  </button>
);

export interface MobileBottomNavProps {
  activeTab: 'code' | 'io' | 'users';
  onActiveTabChange: (tab: 'code' | 'io' | 'users') => void;
}

export const MobileBottomNav = (props: MobileBottomNavProps): JSX.Element => {
  return (
    <div className="grid grid-cols-3 border-t border-line bg-panel-muted pt-2">
      <MobileBottomNavButton
        IconComponent={CodeBracketIcon}
        label="Code"
        isActive={props.activeTab === 'code'}
        onClick={() => props.onActiveTabChange('code')}
        dataTestId="mobile-bottom-nav-code-button"
      />
      <MobileBottomNavButton
        IconComponent={CircleStackIcon}
        label="Input/Output"
        isActive={props.activeTab === 'io'}
        onClick={() => props.onActiveTabChange('io')}
      />
      <MobileBottomNavButton
        IconComponent={UsersIcon}
        label="Users"
        isActive={props.activeTab === 'users'}
        onClick={() => props.onActiveTabChange('users')}
      />
    </div>
  );
};
