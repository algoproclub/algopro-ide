import React, { useState } from 'react';
import Markdown from './Markdown';
import { ChevronUpIcon } from '@heroicons/react/20/solid';
import { type Hint } from '../../types/problem';
import { useEditorContext } from '../../context/EditorContext';

const Hint = ({ index, content }: { index: number; content: string }) => {
  const [revealed, setRevealed] = useState(false);
  // TODO: Track seen hints in the DB.
  const [hasBeenOpened] = useState(false);

  return (
    <div className="mx-0 text-sm border theme-border theme-surface-muted overflow-hidden">
      <button
        type="button"
        className={`flex items-center justify-between theme-text py-2.5 px-3.5 w-full ${
          revealed
            ? 'bg-[color:var(--surface-active)]'
            : 'hover:bg-[color:var(--surface-hover)]'
        }`}
        onClick={() => setRevealed(!revealed)}
      >
        <div className="flex items-center">
          {!hasBeenOpened && (
            <span className="text-[0.5rem] text-[color:var(--accent)] pr-2">
              &#9679;
            </span>
          )}
          <span>Hint {index + 1}</span>
        </div>
        <ChevronUpIcon
          className={`h-5 w-5 ${
            revealed ? '' : 'rotate-180'
          } transition duration-200`}
        />
      </button>
      <div
        className={`px-3.5 border-t theme-border ${
          revealed ? 'py-3' : 'h-0 overflow-hidden !border-0'
        } duration-200`}
      >
        <Markdown>{content}</Markdown>
      </div>
    </div>
  );
};

export default function Hints({ hints }: { hints: Hint[] }): JSX.Element {
  const { fileData } = useEditorContext();
  const langHints = hints.map(hint =>
    typeof hint == 'string' ? hint : hint[fileData.settings.language]
  );
  return (
    <div className="p-4 pb-0 overflow-y-auto h-full space-y-2">
      {langHints
        .filter(x => x)
        .map((hint, i) => (
          <div key={i}>
            <Hint index={i} content={hint!} />
          </div>
        ))}
    </div>
  );
}
