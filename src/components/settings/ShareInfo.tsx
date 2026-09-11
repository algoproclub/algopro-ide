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
      <span className="mr-4 font-medium group-hover:text-content">
        {showCopied ? 'Copied!' : 'Share'}
      </span>
      <span className="relative inline-flex min-w-0 flex-1 items-center rounded py-2 pl-3 pr-10 font-mono group-hover:text-content theme-surface-muted">
        <span className="truncate">{displayUrl}</span>
        <DocumentDuplicateIcon className="absolute bottom-0 right-0 top-0 mr-3 mt-2 h-5 w-5 group-hover:text-content theme-text-muted" />
      </span>
    </div>
  );
};
