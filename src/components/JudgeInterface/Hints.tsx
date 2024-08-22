import React, { useState } from 'react';
import Markdown from './Markdown';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { Hint } from '../../types/problem';
import { useEditorContext } from '../../context/EditorContext';

const Hint = ({ index, content }: { index: number; content: string }) => {
  const [revealed, setRevealed] = useState(false);
  // TODO: Track seen hints in the DB.
  const [hasBeenOpened] = useState(false);

  return (
    <div
      className={`mx-0 text-sm border border-gray-700 bg-[#121212] overflow-hidden`}
    >
      <button
        type="button"
        className={`flex items-center justify-between text-gray-300 py-2.5 px-3.5 w-full ${
          revealed ? 'bg-gray-800' : 'hover:bg-gray-900'
        }`}
        onClick={() => setRevealed(!revealed)}
      >
        <div className="flex items-center">
          {!hasBeenOpened && (
            <span className="text-[0.5rem] text-indigo-500 pr-2">&#9679;</span>
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
        className={`px-3.5 border-t border-gray-700 ${
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
      {langHints.map((hint, i) => (
        <div key={i}>
          <Hint index={i} content={hint} />
        </div>
      ))}
    </div>
  );
}
