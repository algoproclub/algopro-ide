import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
// @ts-ignore
import renderMathInElement from 'katex/dist/contrib/auto-render.js';

export default function Markdown(props: any): JSX.Element {
  console.log(renderMathInElement)
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
