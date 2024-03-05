import React from 'react';
import { ProblemData, Translation } from '../../types/problem';
import {
  ArrowTopRightOnSquareIcon,
  ChevronUpIcon,
} from '@heroicons/react/20/solid';
import { Listbox, Transition } from '@headlessui/react';
import HTMLStatement from './HTMLStatement';

// TODO: We should be getting this from some sort of library.
const LANGUAGE_INFO: Record<string, { name: string; flag: string }> = {
  en: {
    name: 'english',
    flag: '🇺🇸',
  },
  hu: {
    name: 'magyar',
    flag: '🇭🇺',
  },
};

const LanguageSelectorDropdown = ({
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

const PreText = ({ contents }: { contents: string }) => {
  return (
    <pre className="px-2 py-2 mt-1 whitespace-pre bg-[#121212] border border-[#363636] rounded-md text-sm overflow-x-auto">
      {contents}
    </pre>
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
    <div className="relative h-full flex flex-col">
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
                className="font-bold text-xl hover:underline"
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
              <h4 className="text-lg font-semibold">Limits</h4>
              {problem.timeLimit && (
                <div>
                  <b>Time limit:</b> {problem.timeLimit}
                </div>
              )}
              {problem.memoryLimit && (
                <div>
                  <b>Memory limit:</b> {problem.memoryLimit}
                </div>
              )}
            </div>
          )}
          {problem.samples.map((sample, index) => (
            <div key={index} className="mt-2">
              <h4 className="text-lg font-semibold">
                {problem.samples.length === 1
                  ? 'Example'
                  : `Example ${index + 1}`}
              </h4>
              <h5 className="font-semibold">Input</h5>
              <PreText contents={sample.input} />
              <h5 className="font-semibold">Output</h5>
              <PreText contents={sample.output} />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
