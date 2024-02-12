import React, { useCallback } from 'react';
import { ProblemData } from '../../types/problem';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';
import katex from 'katex';

export default function GenericJudgeInterface({
  problem,
}: {
  problem: ProblemData;
}): JSX.Element {
  const refCallback = useCallback((node: HTMLDivElement) => {
    if (node !== null) {
      renderMathInElement(node, {
        delimiters: [
          // For Codeforces
          { left: '$$$', right: '$$$', display: false },
          { left: '$$$$$', right: '$$$$$', display: true },
        ],
      });

      // For AtCoder
      node.querySelectorAll('var').forEach((element: HTMLElement) => {
        katex.render(element.textContent ?? '', element);
      });

      // For CSES
      node.querySelectorAll('.math').forEach((element: Element) => {
        if (!(element instanceof HTMLElement)) return;

        katex.render(element.textContent ?? '', element, {
          displayMode: element.classList.contains('display'),
        });
      });
    }
  }, []);

  return (
    <div className="relative h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <section className="p-4 pb-0">
          <h3>
            <a
              href={problem.url}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-xl hover:underline flex flex-row items-center"
            >
              {problem.title}
              <ArrowTopRightOnSquareIcon
                aria-hidden="true"
                className="ml-1 h-5 w-5"
              />
            </a>
          </h3>
          <div
            id="problem-statement"
            dangerouslySetInnerHTML={{ __html: problem.statement ?? '' }}
            ref={refCallback}
          ></div>
          <style jsx global>{`
            #problem-statement p {
              margin-bottom: 0.5rem;
            }

            #problem-statement .section-title {
              font-size: 1.125rem;
              font-weight: 600;
            }
          `}</style>
        </section>
      </div>
    </div>
  );
}
