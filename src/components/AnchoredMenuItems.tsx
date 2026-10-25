import { MenuItems, type MenuItemsProps } from '@headlessui/react';
import type { ReactNode } from 'react';

export const getAnchoredMenuItemClass = (active: boolean) =>
  `ui-menu-item group py-1.5 ${
    active ? 'bg-surface-hover text-content' : 'text-content'
  }`;

export const anchoredMenuIconClass =
  'mr-2.5 h-4 w-4 text-content-muted group-hover:text-content';

export const AnchoredMenuItems = ({
  anchor,
  children,
  className,
  menuClassName,
}: {
  anchor: MenuItemsProps['anchor'];
  children: ReactNode;
  className: string;
  menuClassName?: string;
}) => (
  <MenuItems
    anchor={anchor}
    modal={false}
    transition
    className={`ui-menu z-50 [--anchor-gap:6px] transition ease-out data-[closed]:opacity-0 data-[closed]:scale-95 data-[enter]:duration-100 data-[leave]:duration-75 ${className} ${menuClassName ?? ''}`}
  >
    {children}
  </MenuItems>
);
