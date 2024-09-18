import { Listbox, Transition } from '@headlessui/react';
import React from 'react';

const Dropdown = ({
  items,
  selected,
  setSelected,
  label,
  disabled,
}: {
  items: string[];
  label?: string;
  selected: number;
  setSelected: (_: number) => void;
  disabled?: boolean;
}) => {
  return (
    <div className="relative w-full min-w-0">
      <Listbox
        value={selected}
        onChange={index => setSelected(index)}
        disabled={disabled}
      >
        {({ open }) => (
          <>
            {label && (
              <Listbox.Label className="text-sm block mb-1 px-1 text-gray-300">
                {label}
              </Listbox.Label>
            )}
            <div className="w-full flex flex-col">
              <Listbox.Button
                className={`relative w-full px-3 py-2 text-left rounded-md border truncate text-sm bg-gray-900 ${
                  open
                    ? 'ring-2 ring-indigo-500 border-transparent'
                    : 'enabled:hover:bg-gray-800 enabled:active:bg-gray-700 border-gray-600 enabled:hover:border-gray-500'
                }`}
              >
                {!disabled ? items[selected] ?? '-' : '-'}
              </Listbox.Button>
              <div className="w-full text-sm relative z-50">
                <Transition
                  enter="transition duration-100 ease-out"
                  enterFrom="transform scale-95 opacity-0"
                  enterTo="transform scale-100 opacity-100"
                  leave="transition duration-75 ease-out"
                  leaveFrom="transform scale-100 opacity-100"
                  leaveTo="transform scale-95 opacity-0"
                >
                  <Listbox.Options className="border border-gray-700 rounded-md bg-gray-900 divide-y divide-gray-700 absolute top-2 w-full cursor-pointer overflow-hidden min-h-[2rem]">
                    {items.map((val, ind) => (
                      <Listbox.Option
                        className="px-3 py-2 hover:bg-gray-800 active:bg-gray-700"
                        key={ind}
                        value={ind}
                      >
                        {val}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </div>
          </>
        )}
      </Listbox>
    </div>
  );
};

export default Dropdown;
