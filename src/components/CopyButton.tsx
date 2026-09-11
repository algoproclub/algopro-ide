import React, { useState } from 'react';
import { CheckIcon, DocumentDuplicateIcon } from '@heroicons/react/20/solid';

export const CopyButton = ({
  btnLabel,
  disabled,
  copiedLabel,
  handleCopy,
}: {
  disabled?: boolean;
  btnLabel?: string;
  copiedLabel?: string;
  handleCopy: () => Promise<void>;
}) => {
  const [copied, setCopied] = useState(0);

  const copy = () => {
    handleCopy().then(() => {
      setCopied(prevCopied => prevCopied + 1);
      setTimeout(() => {
        setCopied(prevCopied => prevCopied - 1);
      }, 5000);
    });
  };

  return (
    <button
      disabled={disabled}
      className={`flex items-center justify-center w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] ${disabled ? 'bg-[var(--success)] text-[color:var(--text-inverted)] opacity-[0.55] cursor-not-allowed' : 'text-[color:var(--text-inverted)] bg-[var(--success)] hover:brightness-110 cursor-pointer'}`}
      onClick={copy}
    >
      {copied === 0 && (
        <>
          <DocumentDuplicateIcon className="mr-2 inline h-4 w-4" />
          {btnLabel}
        </>
      )}
      {copied > 0 && (
        <>
          <CheckIcon className="mr-2 inline h-4 w-4" />
          {copiedLabel}
        </>
      )}
    </button>
  );
};
