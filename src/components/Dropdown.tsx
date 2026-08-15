import { Listbox, Transition } from '@headlessui/react';
import {
  CheckIcon,
  ChevronUpDownIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid';
import classNames from 'classnames';
import React from 'react';
import Tooltip from './Tooltip';

export type DropdownItem<Value extends string | number> = {
  label: React.ReactNode;
  value: Value;
};

export default function Dropdown<Value extends string | number>({
  items,
  selected,
  setSelected,
  label,
  placeholder = '-',
  disabledPlaceholder,
  emptyLabel = 'No options available.',
  onClear,
  disabled,
}: {
  items: readonly DropdownItem<Value>[] | readonly Value[];
  label?: React.ReactNode;
  selected: Value | null;
  setSelected: (value: Value) => void;
  placeholder?: React.ReactNode;
  disabledPlaceholder?: React.ReactNode;
  emptyLabel?: React.ReactNode;
  onClear?: () => void;
  disabled?: boolean;
}) {
  const options = items.map(item =>
    typeof item === 'object' ? item : { label: String(item), value: item }
  );
  const selectedLabel = options.find(item => item.value === selected)?.label;
  const canClear = onClear && selected !== null && !disabled;

  return (
    <div className="relative w-full min-w-0">
      <Listbox
        value={selected}
        onChange={value => {
          if (value !== null) setSelected(value);
        }}
        disabled={disabled}
      >
        {({ open }) => (
          <>
            {label != null && (
              <Listbox.Label className="text-sm block mb-1 px-1 theme-text-muted">
                {label}
              </Listbox.Label>
            )}
            <div className="relative w-full flex flex-col">
              <Listbox.Button
                className={`relative w-full rounded-md border py-2 pl-3 text-left text-sm theme-input disabled:cursor-not-allowed disabled:bg-[var(--surface-bg-muted)] disabled:text-[color:var(--text-disabled)] ${canClear ? 'pr-16' : 'pr-9'} ${
                  open
                    ? 'ring-2 ring-[color:var(--accent)] border-transparent'
                    : 'enabled:hover:bg-[var(--surface-hover)] enabled:active:bg-[var(--surface-active)] enabled:hover:border-[color:var(--border-strong)]'
                }`}
              >
                <span
                  className={classNames(
                    'block truncate',
                    selectedLabel == null && 'theme-text-muted'
                  )}
                >
                  {selectedLabel ??
                    (disabled
                      ? (disabledPlaceholder ?? placeholder)
                      : placeholder)}
                </span>
                <ChevronUpDownIcon className="pointer-events-none absolute inset-y-0 right-2 my-auto h-4 w-4 text-[color:var(--text-muted)]" />
              </Listbox.Button>
              {canClear && (
                <div className="absolute inset-y-0 right-7 flex items-center">
                  <Tooltip label="Clear selection">
                    <button
                      type="button"
                      className="rounded p-0.5 text-[color:var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[color:var(--text-primary)]"
                      onClick={event => {
                        event.stopPropagation();
                        onClear();
                      }}
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </Tooltip>
                </div>
              )}
              <div className="w-full text-sm relative z-50">
                <Transition
                  enter="transition duration-100 ease-out"
                  enterFrom="transform scale-95 opacity-0"
                  enterTo="transform scale-100 opacity-100"
                  leave="transition duration-75 ease-out"
                  leaveFrom="transform scale-100 opacity-100"
                  leaveTo="transform scale-95 opacity-0"
                >
                  <Listbox.Options className="absolute top-2 max-h-60 min-h-[2rem] w-full overflow-hidden overflow-y-auto rounded-md border theme-border theme-surface divide-y divide-[color:var(--border-muted)] focus:outline-none">
                    {options.length === 0 ? (
                      <li className="px-3 py-2 theme-text-muted">
                        {emptyLabel}
                      </li>
                    ) : (
                      options.map(item => (
                        <Listbox.Option
                          className={({ active, selected }) =>
                            classNames(
                              'relative flex cursor-pointer select-none items-center py-2 pl-3 pr-9',
                              active
                                ? 'bg-[var(--surface-hover)]'
                                : selected && 'bg-[var(--surface-active)]'
                            )
                          }
                          key={item.value}
                          value={item.value}
                        >
                          {({ selected }) => (
                            <>
                              <span
                                className={classNames(
                                  'min-w-0 flex-1 truncate',
                                  selected && 'font-medium'
                                )}
                              >
                                {item.label}
                              </span>
                              {selected && (
                                <CheckIcon className="absolute right-3 h-4 w-4 text-[color:var(--accent)]" />
                              )}
                            </>
                          )}
                        </Listbox.Option>
                      ))
                    )}
                  </Listbox.Options>
                </Transition>
              </div>
            </div>
          </>
        )}
      </Listbox>
    </div>
  );
}

const LANGUAGE_INFO = {
  '-': {
    name: 'original',
    flag: '—',
  },
  en: {
    name: 'english',
    flag: '🇺🇸',
  },
  hu: {
    name: 'magyar',
    flag: '🇭🇺',
  },
  es: {
    name: 'español',
    flag: '🇪🇸',
  },
} as const;

export type Language = keyof typeof LANGUAGE_INFO;

export function LanguageSelectorDropdown({
  languages = ['hu', 'en', 'es', '-'],
  language,
  setLanguage,
  ...props
}: {
  languages: Language[];
  language: Language;
  setLanguage: (language: Language) => void;
} & Omit<
  React.ComponentProps<typeof Dropdown>,
  'items' | 'selected' | 'setSelected'
>) {
  return (
    <Dropdown
      items={languages.map(lang => ({
        value: lang,
        label: (
          <span className="space-x-2">
            <span>{LANGUAGE_INFO[lang].flag}</span>
            <span>{LANGUAGE_INFO[lang].name}</span>
          </span>
        ),
      }))}
      label="Language"
      selected={language}
      setSelected={setLanguage}
      {...props}
    />
  );
}
