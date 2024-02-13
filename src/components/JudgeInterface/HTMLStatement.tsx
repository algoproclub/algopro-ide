import React, { useCallback } from 'react';
import renderMathInElement from 'katex/contrib/auto-render';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function HTMLStatement({
  htmlContent,
}: {
  htmlContent: string;
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
    <>
      <div
        className="html-statement-container"
        dangerouslySetInnerHTML={{ __html: htmlContent ?? '' }}
        ref={refCallback}
      ></div>
      <style jsx global>{`
        .html-statement-container p {
          margin-bottom: 0.5rem;
        }

        .html-statement-container .section-title {
          font-size: 1.125rem;
          font-weight: 600;
        }
      `}</style>
    </>
  );
}
