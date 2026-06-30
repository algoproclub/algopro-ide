import { DocumentDuplicateIcon } from '@heroicons/react/20/solid';
import React, { useState } from 'react';

export const ShareInfo = ({
  displayUrl,
}: {
  displayUrl: string;
}): JSX.Element => {
  const [showCopied, setShowCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(
      () => {
        setShowCopied(true);
        setTimeout(() => {
          setShowCopied(false);
        }, 3000);
      },
      () => {
        alert("Couldn't copy to clipboard");
      }
    );
  };

  return (
    <div
      className="px-4 py-1 text-sm group theme-text focus:outline-none max-w-max cursor-pointer flex items-center"
      onClick={() => handleCopy()}
    >
      <span className="font-medium mr-4 group-hover:text-[color:var(--text-primary)]">
        {showCopied ? 'Copied!' : 'Share'}
      </span>
      <span className="font-mono pl-3 pr-10 py-2 theme-surface-muted group-hover:text-[color:var(--text-primary)] rounded inline-flex items-center flex-1 min-w-0 relative">
        <span className="truncate">{displayUrl}</span>
        <DocumentDuplicateIcon className="h-5 w-5 mr-3 mt-2 theme-text-muted group-hover:text-[color:var(--text-primary)] absolute right-0 top-0 bottom-0 " />
      </span>
    </div>
  );
};
