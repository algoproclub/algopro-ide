import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';

export default function Pagination({
  page,
  setPage,
  minPage,
  maxPage,
  label,
  pageDirection = 1,
}: {
  page: number;
  setPage: (_: number) => void;
  minPage: number;
  maxPage: number;
  label: string;
  pageDirection?: 1 | -1;
}) {
  const clampPage = (value: number) =>
    Math.max(minPage, Math.min(value, maxPage));
  const previousPage = clampPage(page - pageDirection);
  const nextPage = clampPage(page + pageDirection);

  return (
    <div className="flex items-center gap-2 border-t border-line bg-panel-muted px-4 py-3 text-sm text-content">
      <button
        className="ui-button-secondary"
        disabled={previousPage === page}
        onClick={() => setPage(previousPage)}
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Previous
      </button>
      <span className="px-2 theme-text-muted">{label}</span>
      <button
        className="ui-button-secondary"
        disabled={nextPage === page}
        onClick={() => setPage(nextPage)}
      >
        Next
        <ChevronRightIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
