import { ArrowPathIcon } from '@heroicons/react/20/solid';
import { Button } from './Button';
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
      <Button
        type="button"
        variant="secondary"
        icon={ArrowPathIcon}
        aria-label={title}
        onClick={onClick}
        disabled={disabled || isLoading}
        className={`${isLoading ? '[&>svg]:animate-spin' : ''} ${
          isAlert ? '[&>svg]:text-[color:var(--warning)]' : ''
        }`}
      />
    </Tooltip>
  );
}
