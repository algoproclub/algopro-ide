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
  return (
    <div
      className={`flex whitespace-nowrap overflow-auto ${
        homepage ? '' : 'bg-gray-950 border-b border-[#323232]'
      }`}
    >
      <div className={`flex-1 ${homepage ? 'space-x-1' : ''}`}>
        {tabs.map(tab => (
          <button
            key={tab.value}
            className={classNames(
              tab.value === activeTab
                ? `${homepage ? 'bg-gray-700' : 'bg-[#323232]'} text-gray-200`
                : `${tab.highlight ? 'text-yellow-400 font-bold' : 'text-gray-400 hover:text-gray-300'}  hover:bg-gray-800 active:bg-gray-800`,
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
