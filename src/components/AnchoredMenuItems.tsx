import { Menu, Transition } from '@headlessui/react';
import type { Placement } from '@popperjs/core';
import React, { Fragment, type ReactNode, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { usePopper } from 'react-popper';

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
  open,
  placement,
}: {
  anchor: HTMLElement | null;
  children: ReactNode;
  className: string;
  menuClassName?: string;
  open: boolean;
  placement: Placement;
}) => {
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const { styles, attributes } = usePopper(anchor, popperElement, {
    placement,
    modifiers: [{ name: 'offset', options: { offset: [0, 6] } }],
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Transition show={open}>
      {mounted
        ? ReactDOM.createPortal(
            <Menu.Items static as="div">
              <div
                ref={setPopperElement}
                style={styles.popper}
                {...attributes.popper}
                className={`z-50 ${className}`}
              >
                <Transition.Child
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <div className={`ui-menu w-full ${menuClassName ?? ''}`}>
                    {children}
                  </div>
                </Transition.Child>
              </div>
            </Menu.Items>,
            document.body
          )
        : null}
    </Transition>
  );
};
