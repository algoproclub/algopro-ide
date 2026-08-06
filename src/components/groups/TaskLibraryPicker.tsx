import { Suspense, useDeferredValue, useState } from 'react';
import Link from 'next/link';
import { useAtomValue } from 'jotai';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { problemLibrarySearchAtom } from '../../atoms/problemLibrary';
import { getPlatformName } from '../../scripts/getPlatformName';
import type { URLProblem } from '../../types/problem';
import Tooltip from '../Tooltip';
import ProblemLibraryRefreshButton from '../ProblemLibraryRefreshButton';

const TaskLibraryResults = ({
  queryText,
  onAdd,
}: {
  queryText: string;
  onAdd: (task: URLProblem) => void;
}) => {
  const taskSearch = useAtomValue(problemLibrarySearchAtom);
  const deferredQueryText = useDeferredValue(queryText);
  const matches = taskSearch
    .search(deferredQueryText, { limit: 12 })
    .map(result => result.item);

  if (!matches.length) {
    return (
      <p className="px-1 pt-3 text-sm text-content-muted">No matching tasks.</p>
    );
  }

  return (
    <div className="mt-2 max-h-72 divide-y divide-line-muted overflow-y-auto rounded-md border border-line">
      {matches.map(task => (
        <div
          key={task.key}
          className="flex items-center gap-2 px-3 py-2 hover:bg-surface-hover"
        >
          <button
            type="button"
            className="min-w-0 flex-1 text-left text-sm"
            onClick={() =>
              onAdd({
                id: task.id,
                title: task.title,
                url: task.url,
                platform: task.platform,
              })
            }
          >
            <span className="block truncate font-medium">{task.title}</span>
            <span className="block text-xs text-content-muted">
              {getPlatformName(task.platform)} · {task.id}
            </span>
            {!!task.tags?.length && (
              <span className="mt-1 flex flex-wrap gap-1">
                {task.tags.slice(0, 4).map(tag => (
                  <span
                    key={tag}
                    className="rounded bg-surface-muted px-1.5 py-0.5 text-[0.65rem] text-content"
                  >
                    {tag}
                  </span>
                ))}
              </span>
            )}
          </button>
          <Tooltip label="Open original problem">
            <Link
              href={task.url}
              target="_blank"
              rel="noreferrer"
              className="ui-icon-button shrink-0"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </Link>
          </Tooltip>
        </div>
      ))}
    </div>
  );
};

export default function TaskLibraryPicker({
  onAdd,
  onClose,
}: {
  onAdd: (task: URLProblem) => void;
  onClose: () => void;
}) {
  const [queryText, setQueryText] = useState('');

  return (
    <section className="border-t border-line bg-surface p-3 text-content">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="search"
          value={queryText}
          onChange={event => setQueryText(event.target.value)}
          placeholder="Search task name, ID, platform, or tag…"
          className="min-w-0 flex-1 rounded-md border border-line bg-input px-3 py-2 text-sm text-content shadow-sm outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
        />
        <button
          type="button"
          className="ui-focus rounded-md px-2 py-2 text-sm text-content-muted hover:bg-surface-hover hover:text-content"
          onClick={onClose}
        >
          Close
        </button>
        <ProblemLibraryRefreshButton />
      </div>
      {queryText.trim() ? (
        <Suspense
          fallback={
            <p className="px-1 pt-3 text-sm text-content-muted">
              Loading task library…
            </p>
          }
        >
          <TaskLibraryResults queryText={queryText} onAdd={onAdd} />
        </Suspense>
      ) : (
        <p className="px-1 pt-3 text-sm text-content-muted">
          Start typing to search all available tasks.
        </p>
      )}
    </section>
  );
}
