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
            // Common LaTeX delimiters (Yosupo and others)
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
          ],
          // Allow math rendering inside pre/code blocks (Yosupo samples)
          ignoredTags: ['script', 'noscript', 'style', 'textarea'],
          throwOnError: false,
        });

        // Match KaTeX styling to multiline blocks so rendered math keeps layout.
        node.querySelectorAll('pre .katex').forEach(element => {
          element.classList.add('katex-display');
        });
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
