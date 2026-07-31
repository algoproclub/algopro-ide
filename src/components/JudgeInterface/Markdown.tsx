import React from 'react';
import ReactMarkdown, { Options as ReactMarkdownOptions } from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
// @ts-expect-error mjs file
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';

export default function Markdown(props: ReactMarkdownOptions): JSX.Element {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (ref.current) {
      renderMathInElement(ref.current);
    }
  });

  return (
    <div ref={ref}>
      <ReactMarkdown
        {...props}
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      />
    </div>
  );
}
