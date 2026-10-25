import { useState } from 'react';
import { Button } from '../Button';

export default function JoinLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}${link}`).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      },
      () => {
        alert("Couldn't copy to clipboard");
      }
    );
  };

  return (
    <div>
      <h4 className="font-medium theme-text px-4">Join Link</h4>
      <div className="mt-2 flex">
        <span className="block pl-4 pr-2 py-1.5 theme-surface-muted rounded theme-text-muted w-full overflow-ellipsis overflow-hidden">
          {window.location.origin}
          {link}
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0 rounded-l-none"
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
