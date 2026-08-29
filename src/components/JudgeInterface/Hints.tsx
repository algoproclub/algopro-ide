import React, { useState } from 'react';
import Markdown from './Markdown';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { type Hint } from '../../types/problem';
import { useEditorContext } from '../../context/EditorContext';

const Hint = ({ index, content }: { index: number; content: string }) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={revealed ? 'bg-panel-muted' : ''}>
      <button
        type="button"
        className={`ui-focus flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium transition-colors ${
          revealed
            ? 'text-content'
            : 'text-content-secondary hover:bg-surface-hover hover:text-content'
        }`}
        onClick={() => setRevealed(value => !value)}
      >
        <span>Hint {index + 1}</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-content-muted transition-transform duration-150 ${
            revealed ? 'rotate-180' : ''
          }`}
        />
      </button>
      {revealed && (
        <div className="px-3 pb-3 text-sm leading-6 text-content-secondary">
          <Markdown>{content}</Markdown>
        </div>
      )}
    </div>
  );
};

export default function Hints({ hints }: { hints: Hint[] }): JSX.Element {
  const { fileData } = useEditorContext();
  const langHints = hints.map(hint =>
    typeof hint == 'string' ? hint : hint[fileData.settings.language]
  );
  return (
    <div className="h-full overflow-y-auto p-4 pb-0">
      <div className="divide-y divide-line-muted overflow-hidden rounded-md border border-line bg-panel">
        {langHints
          .filter(x => x)
          .map((hint, i) => (
            <Hint key={i} index={i} content={hint!} />
          ))}
      </div>
    </div>
  );
}
