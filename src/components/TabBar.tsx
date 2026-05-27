import classNames from 'classnames';
import React from 'react';

export interface TabBarProps {
  tabs: {
    label: string;
    value: string;
    highlight?: boolean;
  }[];
  activeTab: string;
  onTabSelect?: (tab: { label: string; value: string }) => void;
  homepage?: boolean;
}

export const TabBar = ({
  tabs,
  activeTab,
  onTabSelect,
  homepage,
}: TabBarProps): JSX.Element => {
  tabs.find(tab => tab.value === activeTab)!.highlight = false;
  // szda re-theme phase1: default tabs use shell tokens instead of hardcoded dark grays.
  const defaultTabBarClass =
    'bg-[var(--panel-bg-alt)] border-b border-[var(--border-color)]';
  const activeTabClass = homepage
    ? 'bg-[var(--surface-active)] text-[var(--text-primary)]'
    : 'bg-[var(--panel-bg)] text-[var(--text-primary)]';
  const inactiveTabClass =
    'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-bg)] active:bg-[var(--hover-bg)]';

  return (
    <div
      className={`flex whitespace-nowrap overflow-auto ${
        homepage ? '' : defaultTabBarClass
      }`}
    >
      <div className={`flex-1 ${homepage ? 'space-x-1' : ''}`}>
        {tabs.map(tab => (
          <button
            key={tab.value}
            className={classNames(
              tab.value === activeTab
                ? activeTabClass
                : `${tab.highlight ? 'text-yellow-400 font-bold' : inactiveTabClass}`,
              `px-4 py-1 ${
                homepage ? 'rounded-t-md' : ''
              } text-sm focus:outline-none transition`
            )}
            onClick={() => {
              tab.highlight = false;
              if (onTabSelect) onTabSelect(tab);
            }}
          >
            {tab.label + (tab.highlight ? ' *' : '')}
          </button>
        ))}
      </div>
    </div>
  );
};
