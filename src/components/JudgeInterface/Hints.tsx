import React, { useState } from 'react';
import Markdown from './Markdown';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid';

const Hint = ({ index, content }: { index: number; content: string }) => {
  const [revealed, setRevealed] = useState(false);
  // TODO: Track seen hints in the DB.
  const [hasBeenOpened] = useState(false);

  return (
    <div className="mx-0 rounded-md mt-4 mb-4 bg-[#121212] border border-t-0 border-[#363636]">
      <button
        type="button"
        className="flex items-center justify-between py-2.5 px-4 bg-gray-800 border-b border-t rounded-t-md w-full border-[#363636] text-sm"
        onClick={() => setRevealed(!revealed)}
      >
        <span className={hasBeenOpened ? '' : 'font-semibold'}>
          Hint {index + 1}
        </span>
        {revealed ? (
          <ChevronUpIcon className="h-5 w-5" />
        ) : (
          <ChevronDownIcon className="h-5 w-5" />
        )}
      </button>
      <div
        className={`px-4 ${
          revealed
            ? 'py-3 translate-y-0 opacity-100'
            : 'py-0 h-0 overflow-hidden translate-y-[-1px]'
        } duration-200`}
      >
        <Markdown>{content}</Markdown>
      </div>
    </div>
  );
};

export default function Hints({ hints }: { hints: string[] }): JSX.Element {
  return (
    <div className="p-4 pb-0 overflow-y-auto h-full">
      {hints.map((hint, i) => (
        <div key={i + 1}>
          <Hint index={i} content={hint} />
        </div>
      ))}
    </div>
  );
}
