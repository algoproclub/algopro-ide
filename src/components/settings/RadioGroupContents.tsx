import { RadioGroup } from '@headlessui/react';
import classNames from 'classnames';
import React from 'react';

export function RadioGroupContents<T>({
  title,
  value,
  onChange,
  options,
  disabled,
  lightMode,
  horizontal,
  className,
}: {
  title: string;
  value: T | null;
  onChange: (newVal: T) => void;
  options: {
    label: string;
    value: T;
  }[];
  disabled?: boolean;
  lightMode?: boolean;
  horizontal?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <RadioGroup value={value} onChange={onChange} disabled={disabled}>
      <RadioGroup.Label
        as="div"
        className={classNames(
          lightMode ? '' : 'mb-1',
          'text-gray-300',
          'text-sm',
          className
        )}
      >
        {title}
      </RadioGroup.Label>
      <div
        className={`mt-1 rounded-md ${
          horizontal ? 'space-x-4 flex' : 'space-y-1'
        }`}
      >
        {options.map(setting => (
          <RadioGroup.Option
            key={setting.label}
            value={setting.value}
            className="relative flex items-center cursor-pointer focus:outline-none"
          >
            {({ active, checked }) => (
              <>
                <span
                  className="h-4 w-4 mt-0.5 cursor-pointer rounded-full flex items-center justify-center bg-gray-500"
                  aria-hidden="true"
                >
                  <span className="flex items-center justify-center bg-gray-900 w-3.5 h-3.5 rounded-full">
                    <span
                      className={`rounded-full ${
                        checked ? 'bg-indigo-500 scale-100' : 'scale-0'
                      } transition w-2.5 h-2.5`}
                    />
                  </span>
                </span>
                <div className="ml-2 flex flex-col">
                  <RadioGroup.Label
                    as="span"
                    className={classNames(
                      checked
                        ? !lightMode
                          ? 'text-gray-200'
                          : 'text-gray-800'
                        : !lightMode
                        ? 'text-gray-400'
                        : 'text-gray-600',
                      'block text-sm'
                    )}
                  >
                    {setting.label}
                  </RadioGroup.Label>
                </div>
              </>
            )}
          </RadioGroup.Option>
        ))}
      </div>
    </RadioGroup>
  );
}
