import React, { useCallback } from 'react';
import renderMathInElement from 'katex/contrib/auto-render';
import katex from 'katex';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function renderYosupoFormatMath(element: HTMLElement) {
  const text = element.textContent ?? '';
  const mathPattern = /\$([^$\n]+)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let html = '';

  while ((match = mathPattern.exec(text))) {
    html += escapeHtml(text.slice(lastIndex, match.index));
    html += katex.renderToString(match[1], { throwOnError: false });
    lastIndex = mathPattern.lastIndex;
  }

  html += escapeHtml(text.slice(lastIndex));
  element.innerHTML = html;
}

export default function HTMLStatement({
  htmlContent,
  renderYosupoMath = false,
}: {
  htmlContent: string;
  renderYosupoMath?: boolean;
}): JSX.Element {
  const refCallback = useCallback(
    (node: HTMLDivElement) => {
      if (node !== null) {
        if (renderYosupoMath) {
          node.querySelectorAll('code').forEach(element => {
            if (
              element instanceof HTMLElement &&
              (element.classList.contains('language-yosupo-format') ||
                element.parentElement?.tagName !== 'PRE')
            ) {
              renderYosupoFormatMath(element);
            }
          });
        }

        renderMathInElement(node, {
          delimiters: [
            // For Codeforces
            { left: '$$$$$$', right: '$$$$$$', display: true },
            { left: '$$$', right: '$$$', display: false },
            ...(renderYosupoMath
              ? [
                  { left: '$$', right: '$$', display: true },
                  { left: '$', right: '$', display: false },
                ]
              : []),
          ],
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
    [renderYosupoMath]
  );

  return (
    <>
      <div
        key={htmlContent}
        className="html-statement-container"
        dangerouslySetInnerHTML={{ __html: htmlContent ?? '' }}
        ref={refCallback}
      ></div>
    </>
  );
}
