import { ArrowPathIcon } from '@heroicons/react/20/solid';
import Tooltip from './Tooltip';

export default function RefreshButton({
  onClick,
  title = 'Refresh',
  disabled = false,
  isLoading = false,
  isAlert = false,
}: {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  isLoading?: boolean;
  isAlert?: boolean;
}) {
  return (
    <Tooltip label={title}>
      <button
        type="button"
        aria-label={title}
        onClick={onClick}
        disabled={disabled || isLoading}
        className="ui-icon-button border-line bg-control shadow-sm"
      >
        <ArrowPathIcon
          className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''} ${
            isAlert ? 'text-[color:var(--warning)]' : ''
          }`}
        />
      </button>
    </Tooltip>
  );
}
