import React from 'react';
import { ProblemData, Translation } from '../../types/problem';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import HTMLStatement from './HTMLStatement';
import { LanguageSelectorDropdown } from '../Dropdown';

export const PDFDisplay = ({ url }: { url: string }) => {
  return (
    <object data={url} type="application/pdf" className="w-full block h-full">
      <a href={url} target="_blank" rel="noreferrer" className="underline">
        Open problem statement
      </a>
    </object>
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
  // FIXME: Pass down well-typed languages list.
  const languages = Object.keys(translations) as ('hu' | 'en' | 'es' | '-')[];
  const translation = translations[language];

  return (
    <div className="relative h-full flex flex-col text-[0.92rem]">
      <div className="flex-1 overflow-y-auto pb-4">
        <header className="items-center">
          {languages.length > 1 && (
            <div className="p-4 border-b theme-border">
              <LanguageSelectorDropdown
                languages={languages}
                language={language as 'hu' | 'en' | 'es' | '-'}
                setLanguage={setLanguage}
              />
            </div>
          )}
        </header>
        <section className="px-4 pt-2 h-full">
          <h3 className="flex-1">
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
          {translation &&
            ('statement' in translation ? (
              <HTMLStatement htmlContent={translation.statement} />
            ) : (
              <PDFDisplay url={translation.statementURL} />
            ))}
          {(problem.timeLimit || problem.memoryLimit) && (
            <div>
              <h4 className="text-base font-semibold mt-[0.6rem] mb-[0.25rem]">
                Limits
              </h4>
              <ul className="list-disc ml-6">
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
        </section>
      </div>
    </div>
  );
}
