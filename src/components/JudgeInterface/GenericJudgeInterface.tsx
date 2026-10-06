import React, { useCallback } from 'react';
import { ProblemData, Translation } from '../../types/problem';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import renderMathInElement from 'katex/contrib/auto-render';
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
  const titleRef = useCallback(
    (node: HTMLSpanElement | null) => {
      if (node !== null && problem.platform === 'yosupo') {
        renderMathInElement(node, {
          delimiters: [{ left: '$', right: '$', display: false }],
          throwOnError: false,
        });
      }
    },
    [problem.platform]
  );

  return (
    <div className="relative flex h-full flex-col text-sm leading-6">
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
        <section className="h-full px-4 pt-2">
          <h3 className="flex-1 text-pretty">
            <a
              href={problem.url}
              target="_blank"
              rel="noreferrer"
              className="text-lg font-semibold tracking-tight hover:underline"
            >
              <span key={problem.title} ref={titleRef}>
                {problem.title}
              </span>
              <ArrowTopRightOnSquareIcon
                aria-hidden="true"
                className="ml-1 h-5 w-5 inline"
              />
            </a>
          </h3>
          {translation &&
            ('statement' in translation ? (
              <HTMLStatement
                htmlContent={translation.statement}
                renderYosupoMath={problem.platform === 'yosupo'}
              />
            ) : (
              <PDFDisplay url={translation.statementURL} />
            ))}
          {(problem.timeLimit || problem.memoryLimit) && (
            <div>
              <h4 className="mb-1 mt-4 text-base font-semibold leading-6">
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
