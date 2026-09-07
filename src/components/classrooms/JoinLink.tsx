import { useState } from 'react';

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
        <button
          className="theme-text-muted hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)] bg-[color:var(--surface-bg-muted)] px-2 text-sm font-medium"
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
