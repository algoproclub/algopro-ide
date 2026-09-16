import {
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  fetchOwnedFilesPage,
  type UserFilesPage,
} from '../../data/userProfile';
import CodeSizeLabel from '../TaskStatus/CodeSizeLabel';
import TaskStatusIndicator from '../TaskStatus/TaskStatusIndicator';
import TimeAgoLabel from '../TimeStamp';

const PAGE_SIZE = 10;

export default function UserFilesSection({
  userID,
  active,
}: {
  userID: string;
  /** Files are only queried once the section has been opened. */
  active: boolean;
}) {
  const [pages, setPages] = useState<Array<UserFilesPage | undefined>>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [failedPageIndex, setFailedPageIndex] = useState<number | null>(null);
  const page = pages[pageIndex];
  const hasFailed = failedPageIndex === pageIndex;

  useEffect(() => {
    if (!active || page) return;
    const cursor = pageIndex === 0 ? null : pages[pageIndex - 1]?.nextCursor;
    if (cursor === undefined) return;

    let isCurrent = true;
    fetchOwnedFilesPage(userID, cursor, PAGE_SIZE).then(
      loaded => {
        if (!isCurrent) return;
        setPages(current => {
          const next = [...current];
          next[pageIndex] = loaded;
          return next;
        });
      },
      error => {
        console.error(error);
        if (isCurrent) setFailedPageIndex(pageIndex);
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [active, page, pageIndex, pages, userID]);

  const isLoading = active && !page && !hasFailed;
  const hasNextPage = page ? page.nextCursor !== null : false;

  return (
    <>
      <div className="w-full max-w-full overflow-x-auto">
        <table className="table-filelist w-full border-line bg-surface text-sm text-content">
          <thead className="border-b border-line-muted bg-surface-raised">
            <tr>
              <th className="ui-table-heading">Workspace name</th>
              <th className="ui-table-heading whitespace-nowrap">
                Last access
              </th>
              <th className="ui-table-heading">Created</th>
              <th className="ui-table-heading">Language</th>
              <th className="ui-table-heading whitespace-nowrap text-right">
                Code size
              </th>
              <th className="ui-table-heading">Problem</th>
              <th className="ui-table-heading">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-muted">
            {page?.files.map(file => (
              <tr key={file.id} className="hover:bg-surface-hover">
                <td className="min-w-0">
                  <Link
                    href={`/${file.id.slice(1)}`}
                    className="font-medium hover:text-accent-hover hover:underline"
                    prefetch={false}
                  >
                    {file.title}
                  </Link>
                  {file.hidden && (
                    <span className="ml-2 rounded-full border border-line px-1.5 py-0.5 text-[0.65rem] text-content-muted">
                      Hidden
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap text-content-muted">
                  {file.lastAccessTime ? (
                    <TimeAgoLabel date={new Date(file.lastAccessTime)} />
                  ) : (
                    '—'
                  )}
                </td>
                <td className="whitespace-nowrap text-content-muted">
                  {file.creationTime ? (
                    <TimeAgoLabel date={new Date(file.creationTime)} />
                  ) : (
                    '—'
                  )}
                </td>
                <td className="whitespace-nowrap text-content-muted">
                  {file.language ?? '—'}
                </td>
                <td className="whitespace-nowrap text-right tabular-nums text-content-muted">
                  <CodeSizeLabel size={file.status?.codeSize} />
                </td>
                <td className="min-w-0 text-content-muted">
                  {!file.problem ? (
                    '—'
                  ) : file.problem.url ? (
                    <Link
                      href={file.problem.url}
                      className="hover:text-accent-hover hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      prefetch={false}
                    >
                      {file.problem.label}
                      <ArrowTopRightOnSquareIcon className="ml-1 inline h-3 w-3" />
                    </Link>
                  ) : (
                    file.problem.label
                  )}
                </td>
                <td className="min-w-0">
                  {file.problem && file.status ? (
                    <TaskStatusIndicator
                      state={{ status: 'ready', data: file.status }}
                    />
                  ) : (
                    <span className="text-content-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!page?.files.length && (
              <tr>
                <td colSpan={7} className="h-28 text-center text-content-muted">
                  {hasFailed
                    ? 'The files could not be loaded.'
                    : isLoading
                      ? 'Loading files…'
                      : pageIndex === 0
                        ? 'This student owns no shared files.'
                        : 'No more files on this page.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 border-t border-line-muted px-3 py-2 text-sm">
        <button
          type="button"
          className="ui-button-secondary"
          disabled={pageIndex === 0}
          onClick={() => setPageIndex(index => Math.max(0, index - 1))}
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Previous
        </button>
        <span className="px-2 text-content-muted">Page {pageIndex + 1}</span>
        <button
          type="button"
          className="ui-button-secondary"
          disabled={!hasNextPage}
          onClick={() => setPageIndex(index => index + 1)}
        >
          Next
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
