import { ArrowPathIcon } from '@heroicons/react/20/solid';
import Tooltip from './Tooltip';

export default function RefreshButton({
  onClick,
  title = 'Refresh',
  disabled = false,
  isLoading = false,
}: {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  isLoading?: boolean;
}) {
  return (
    <Tooltip label={title}>
      <button
        type="button"
        aria-label={title}
        onClick={onClick}
        disabled={disabled || isLoading}
        className="inline-flex items-center justify-center rounded-md border p-2 transition-colors theme-button-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] enabled:hover:border-[color:var(--border-strong)] enabled:active:bg-[color:var(--surface-active)] disabled:border-transparent disabled:ring-1 disabled:ring-inset disabled:ring-[color:var(--border-color)]"
      >
        <ArrowPathIcon
          className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
        />
      </button>
    </Tooltip>
  );
}
