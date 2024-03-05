import React from 'react';
import { ProblemData, Translation } from '../../types/problem';
import {
  ArrowTopRightOnSquareIcon,
  ChevronUpIcon,
} from '@heroicons/react/20/solid';
import { Listbox, Transition } from '@headlessui/react';
import HTMLStatement from './HTMLStatement';
import { PreBox } from './Samples';

// TODO: We should be getting this from some sort of library.
const LANGUAGE_INFO: Record<string, { name: string; flag: string }> = {
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
};

export const LanguageSelectorDropdown = ({
  languages,
  language,
  setLanguage,
}: {
  languages: string[];
  language: string;
  setLanguage: (language: string) => void;
}) => {
  return (
    <div className="relative z-0">
      <Listbox value={language} onChange={setLanguage}>
        {({ open }) => (
          <>
            <div className="w-full flex space-x-2">
              <div className="w-full text-sm relative z-20">
                <Listbox.Button
                  className={`w-full bg-[#121212] px-3.5 py-2.5 flex items-center justify-between truncate rounded-md border text-gray-300 ${
                    open
                      ? 'ring-2 ring-indigo-500 border-transparent bg-gray-800'
                      : 'hover:bg-gray-900 active:bg-gray-700 border-gray-700'
                  }`}
                >
                  <span className="space-x-2">
                    <span>{LANGUAGE_INFO[language].flag}</span>
                    <span>{LANGUAGE_INFO[language].name}</span>
                  </span>
                  <ChevronUpIcon
                    className={`h-5 w-5 inline ml-2 ${
                      open ? '' : 'rotate-180'
                    } transition duration-200`}
                  />
                </Listbox.Button>
                <Transition
                  enter="transition duration-100 ease-out"
                  enterFrom="transform scale-95 opacity-0"
                  enterTo="transform scale-100 opacity-100"
                  leave="transition duration-75 ease-out"
                  leaveFrom="transform scale-100 opacity-100"
                  leaveTo="transform scale-95 opacity-0"
                >
                  <Listbox.Options
                    static
                    className="z-20 border border-gray-700 rounded-md bg-[#121212] divide-y divide-gray-700 absolute top-2 w-full cursor-pointer overflow-hidden"
                  >
                    {languages.map(val => (
                      <Listbox.Option
                        className="px-3 py-2 hover:bg-gray-800 active:bg-gray-700 select-none"
                        key={val}
                        value={val}
                      >
                        <span className="space-x-2">
                          <span>{LANGUAGE_INFO[val].flag}</span>
                          <span>{LANGUAGE_INFO[val].name}</span>
                        </span>
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

export default function GenericJudgeInterface({
  problem,
  translations,
  language,
  setLanguage,
}: {
  problem: ProblemData;
  translations: Record<string, Translation>;
  language: string;
  setLanguage: React.Dispatch<React.SetStateAction<string>>;
}): JSX.Element {
  // TODO: Move the original text under translations
  if (problem?.statement) {
    translations['en'] = {
      statement: problem.statement,
      hints: problem.hints ?? [],
    };
  }
  const languages = Object.keys(translations);

  return (
    <div className="relative h-full flex flex-col text-[0.92rem]">
      <div className="flex-1 overflow-y-auto">
        <section className="p-4">
          <header className="items-center">
            <div className="mb-2">
              {languages.length > 1 && (
                <LanguageSelectorDropdown
                  languages={languages}
                  language={language}
                  setLanguage={setLanguage}
                />
              )}
            </div>
            <h3 className="flex-1 mt-0">
              <a
                href={problem.url}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-lg hover:underline"
              >
                {problem.title}
                <ArrowTopRightOnSquareIcon
                  aria-hidden="true"
                  className="ml-1 h-5 w-5 inline"
                />
              </a>
            </h3>
          </header>
          <HTMLStatement htmlContent={translations[language].statement} />
          {(problem.timeLimit || problem.memoryLimit) && (
            <div>
              <h4 className="text-base font-semibold mt-[0.6rem] mb-[0.25rem]">
                Limits
              </h4>
              <ul className="list-disc list-inside ml-2">
                {problem.timeLimit && (
                  <li>
                    <span>Time:</span> {problem.timeLimit}
                  </li>
                )}
                {problem.memoryLimit && (
                  <li>
                    <span>Memory:</span> {problem.memoryLimit}
                  </li>
                )}
              </ul>
            </div>
          )}
          <h4 className="text-base font-semibold mt-[0.6rem] mb-[0.25rem]">
            Examples
          </h4>
          <div className="mt-2 space-y-3">
            {problem.samples.map((sample, index) => (
              <div key={index} className="mb-4">
                <div className="mb-3 -space-y-[1px]">
                  <PreBox
                    title={`Input ${index + 1}`}
                    text={sample.input}
                    roundedBottom={false}
                  />
                  <PreBox
                    title={`Output ${index + 1}`}
                    text={sample.output}
                    roundedTop={false}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
