import { Tab } from '@headlessui/react';
import classNames from 'classnames';
import React from 'react';

export interface TabBarItemProps<Id extends string> {
  id: Id;
  label: string;
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
  listClassName = 'border-b border-[var(--border-color)] bg-[var(--panel-bg-alt)]',
  tabClassName,
  activeTabClassName = 'bg-[var(--panel-bg)] text-[color:var(--text-primary)]',
  inactiveTabClassName = 'text-[color:var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[color:var(--text-primary)] active:bg-[var(--hover-bg)]',
  highlightedTabClassName = 'font-bold text-yellow-400',
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
          'flex overflow-auto whitespace-nowrap',
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
                'px-4 py-1 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--accent)]',
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
