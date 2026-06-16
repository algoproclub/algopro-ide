import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

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
      // szda re-theme phase2: copy action uses shared success and disabled tokens.
      className={`flex items-center justify-center w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] ${disabled ? 'bg-[var(--success)] text-[color:var(--text-inverted)] opacity-[0.55] cursor-not-allowed' : 'text-[color:var(--text-inverted)] bg-[var(--success)] hover:brightness-110 cursor-pointer'}`}
      onClick={copy}
    >
      {copied === 0 && (
        <>
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'copy' }}
            className="mr-2 w-4 h-4 inline"
          />
          {btnLabel}
        </>
      )}
      {copied > 0 && (
        <>
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'check' }}
            className="mr-2 w-4 h-4 inline"
          />
          {copiedLabel}
        </>
      )}
    </button>
  );
};
