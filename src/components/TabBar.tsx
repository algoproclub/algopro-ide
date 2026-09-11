import { Tab } from '@headlessui/react';
import classNames from 'classnames';
import React from 'react';

export interface TabBarItemProps<Id extends string> {
  id: Id;
  label: React.ReactNode;
  highlight?: boolean;
  unmount?: boolean;
  children: React.ReactNode;
}

export interface TabBarProps<Id extends string> {
  selectedId: Id;
  onSelectionChange?: (id: Id) => void;
  ariaLabel: string;
  children: React.ReactNode;
  listClassName?: string;
  tabClassName?: string;
  activeTabClassName?: string;
  inactiveTabClassName?: string;
  highlightedTabClassName?: string;
  panelsClassName?: string;
}

function TabBarItem<Id extends string>({
  children,
  unmount,
}: TabBarItemProps<Id>): JSX.Element {
  return (
    <Tab.Panel unmount={unmount} className="h-full">
      {children}
    </Tab.Panel>
  );
}

function TabBarRoot<Id extends string>({
  selectedId,
  onSelectionChange,
  ariaLabel,
  children,
  listClassName = 'border-b border-line bg-panel-muted px-1',
  tabClassName,
  activeTabClassName = 'border-content-secondary bg-surface-raised text-content',
  inactiveTabClassName = 'border-transparent text-content-muted hover:border-line-strong hover:bg-surface-hover hover:text-content',
  highlightedTabClassName = 'border-transparent font-semibold text-warning',
  panelsClassName,
}: TabBarProps<Id>): JSX.Element {
  const items = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<TabBarItemProps<Id>> =>
      React.isValidElement(child) && child.type === TabBarItem
  );
  const matchingIndex = items.findIndex(item => item.props.id === selectedId);
  const selectedIndex = Math.max(0, matchingIndex);
  const fallbackId = items[0]?.props.id;

  React.useEffect(() => {
    if (matchingIndex === -1 && fallbackId) {
      onSelectionChange?.(fallbackId);
    }
  }, [fallbackId, matchingIndex, onSelectionChange]);

  return (
    <Tab.Group
      selectedIndex={selectedIndex}
      onChange={index => {
        const selectedItem = items[index];
        if (selectedItem) onSelectionChange?.(selectedItem.props.id);
      }}
    >
      <Tab.List
        aria-label={ariaLabel}
        className={classNames(
          'flex overflow-x-auto overflow-y-hidden whitespace-nowrap',
          listClassName
        )}
      >
        {items.map(item => (
          <Tab
            key={item.props.id}
            className={({ selected }) =>
              classNames(
                selected
                  ? activeTabClassName
                  : item.props.highlight
                    ? highlightedTabClassName
                    : inactiveTabClassName,
                '-mb-px border-b-2 px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus',
                tabClassName
              )
            }
          >
            {({ selected }) => (
              <>
                {item.props.label}
                {item.props.highlight && !selected && ' *'}
              </>
            )}
          </Tab>
        ))}
      </Tab.List>
      <Tab.Panels className={panelsClassName}>{items}</Tab.Panels>
    </Tab.Group>
  );
}

export const TabBar = Object.assign(TabBarRoot, { Item: TabBarItem });
