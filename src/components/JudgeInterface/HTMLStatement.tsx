import React, { useCallback } from 'react';
import renderMathInElement from 'katex/contrib/auto-render';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export default function HTMLStatement({
  htmlContent,
}: {
  htmlContent: string;
}): JSX.Element {
  const refCallback = useCallback(
    (node: HTMLDivElement) => {
      if (node !== null) {
        renderMathInElement(node, {
          delimiters: [
            // For Codeforces
            { left: '$$$$$$', right: '$$$$$$', display: true },
            { left: '$$$', right: '$$$', display: false },
            // C LaTeX delimiters 
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
          ],
          // math render inside pre/code blocks
          ignoredTags: ['script', 'noscript', 'style', 'textarea'],
        });

        const render = (element: HTMLElement, displayMode: boolean) => {
          const math = element.textContent ?? '';
          try {
            katex.render(math, element, { displayMode });
          } catch (e) {
            element.textContent = math;
            element.classList.add('math-parse-error');
            console.error("Failed to render math '" + math + "'", e);
          }
        };

        // For AtCoder and CSES
        node.querySelectorAll('var, .math').forEach((element: Element) => {
          if (!(element instanceof HTMLElement)) return;

          render(element, element.classList.contains('display'));
        });
      }
    },
    [htmlContent]
  );

  return (
    <>
      <div
        className="html-statement-container"
        dangerouslySetInnerHTML={{ __html: htmlContent ?? '' }}
        ref={refCallback}
      ></div>
    </>
  );
}
