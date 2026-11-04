import React, { useState } from 'react';
import { CheckIcon, DocumentDuplicateIcon } from '@heroicons/react/20/solid';
import { Button } from './Button';

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
    <Button
      disabled={disabled}
      variant="success"
      className="w-full"
      icon={copied === 0 ? DocumentDuplicateIcon : CheckIcon}
      onClick={copy}
    >
      {copied === 0 ? btnLabel : copiedLabel}
    </Button>
  );
};
