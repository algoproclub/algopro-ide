import { Disclosure } from '@headlessui/react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import React from 'react';

export default function ProfileSection({
  title,
  summary,
  defaultOpen = false,
  headingLevel: Heading = 'h2',
  children,
}: {
  title: React.ReactNode;
  /** Stays visible while the section is collapsed. */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  headingLevel?: 'h2' | 'h3';
  children: (open: boolean) => React.ReactNode;
}) {
  return (
    <Disclosure defaultOpen={defaultOpen}>
      {({ open }) => (
        <section className="overflow-hidden rounded-lg border border-line bg-surface-raised text-content">
          <Heading className="m-0 text-base">
            <Disclosure.Button className="ui-focus flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover">
              <ChevronRightIcon
                className={`h-4 w-4 shrink-0 text-content-muted transition-transform duration-150 ${
                  open ? 'rotate-90' : ''
                }`}
                aria-hidden="true"
              />
              <span className="font-semibold">{title}</span>
              {summary && (
                <span className="ml-auto flex items-center gap-2 text-xs text-content-muted">
                  {summary}
                </span>
              )}
            </Disclosure.Button>
          </Heading>
          {/* The panel stays mounted so lazily loaded sections keep their data
              and their pagination position while the section is collapsed. */}
          <Disclosure.Panel
            static
            hidden={!open}
            className="border-t border-line-muted"
          >
            {children(open)}
          </Disclosure.Panel>
        </section>
      )}
    </Disclosure>
  );
}
