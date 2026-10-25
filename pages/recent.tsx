import React, { useEffect, useMemo, useState } from 'react';
import {
  getDatabase,
  ref,
  get,
  query,
  orderByChild,
  startAt,
} from 'firebase/database';
import { FileData } from '../src/context/EditorContext';
import { StatusData } from '../src/types/problem';
import {
  getSubmissionOutcome,
  isSubmissionPending,
  type SubmissionOutcome,
} from '../src/data/submissionStatus';
import {
  getOutcomeDisplay,
  getSubmissionStatusDisplay,
  submittingDisplay,
} from '../src/components/TaskStatus/statusDisplay';
import CodeSizeLabel from '../src/components/TaskStatus/CodeSizeLabel';
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  EllipsisHorizontalIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/20/solid';
import LoadingIndicator from '../src/components/LoadingIndicator';
import WithTeacherLogin from '../src/components/WithTeacherLogin';
import PageTitle from '../src/components/PageTitle';
import RefreshButton from '../src/components/RefreshButton';
import TimeAgoLabel from '../src/components/TimeStamp';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const TIME_RANGES = [
  { label: '5m', phrase: 'the last 5 minutes', ms: 5 * MINUTE },
  { label: '15m', phrase: 'the last 15 minutes', ms: 15 * MINUTE },
  { label: '1h', phrase: 'the last hour', ms: HOUR },
  { label: '3h', phrase: 'the last 3 hours', ms: 3 * HOUR },
  { label: '12h', phrase: 'the last 12 hours', ms: 12 * HOUR },
  { label: '1d', phrase: 'the last day', ms: DAY },
  { label: '7d', phrase: 'the last 7 days', ms: 7 * DAY },
];
const widestTimeRange = TIME_RANGES[TIME_RANGES.length - 1];

const SUBMISSION_STATUS = [
  'pending',
  'accepted',
  'incorrect',
  'error',
  'untried',
] as const;
type SubmissionStatus = (typeof SUBMISSION_STATUS)[number];
type StatusDisplay = ReturnType<typeof getSubmissionStatusDisplay>;

const verdictChips: Record<
  SubmissionStatus,
  { label: string; display: StatusDisplay }
> = {
  pending: { label: 'Pending', display: submittingDisplay },
  accepted: { label: 'Accepted', display: getOutcomeDisplay('accepted') },
  incorrect: { label: 'Incorrect', display: getOutcomeDisplay('incorrect') },
  error: {
    label: 'Submission error',
    display: getOutcomeDisplay('submission-error'),
  },
  untried: { label: 'Untried', display: getOutcomeDisplay('untried') },
};

type MainFileData = {
  workspaceName: string;
  owner: string;
  fileID: string;
  lastVerdict: string;
  display: StatusDisplay;
  submissionStatus: SubmissionStatus;
  hasProblem: boolean;
  lastEdit: number;
  codeSize: number;
};

type ShowVerdict = {
  [v in SubmissionStatus]: boolean;
};

const columns: Array<{
  label: string;
  compare: (a: MainFileData, b: MainFileData) => number;
}> = [
  {
    label: 'Workspace name',
    compare: (a, b) => a.workspaceName.localeCompare(b.workspaceName),
  },
  { label: 'Owner', compare: (a, b) => a.owner.localeCompare(b.owner) },
  {
    label: 'Last verdict',
    compare: (a, b) => a.display.label.localeCompare(b.display.label),
  },
  { label: 'Last edit', compare: (a, b) => a.lastEdit - b.lastEdit },
  { label: 'Code size', compare: (a, b) => a.codeSize - b.codeSize },
];

const allVerdicts: ShowVerdict = {
  accepted: true,
  incorrect: true,
  pending: true,
  error: true,
  untried: true,
};

const db = getDatabase();
const maxPageLength = 16;

const secondaryButtonClass =
  'border theme-border text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)]';
const activeButtonClass =
  'border-transparent bg-[color:var(--accent)] text-[color:var(--text-inverted)] hover:bg-[color:var(--accent-hover)]';
const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--focus-ring)]';
const skeletonWidths = ['w-40', 'w-24', 'w-28', 'w-16', 'w-12'];

const StatusIcon = ({
  display,
  className,
}: {
  display: StatusDisplay;
  className: string;
}) => (
  <display.Icon
    className={`shrink-0 ${className} ${display.colorClass} ${display.standaloneClass} ${
      display.spins ? 'animate-spin' : ''
    }`}
  />
);

const FilterChip = ({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)] ${focusRingClass} ${
      pressed
        ? 'border-[color:var(--accent)] bg-[color:var(--surface-hover)] text-[color:var(--text-primary)]'
        : 'border-dashed theme-border theme-text-muted'
    }`}
  >
    {children}
  </button>
);

const Pagination = ({
  page,
  maxPage,
  onChange,
}: {
  page: number;
  maxPage: number;
  onChange: (page: number) => void;
}) => {
  const pages = [-2, -1, 0, 1, 2]
    .map(offset => page + offset)
    .filter(candidate => candidate >= 1 && candidate <= maxPage);

  return (
    <div className="flex items-stretch space-x-1">
      <button
        type="button"
        title="First page"
        className={`px-3 py-1 rounded flex items-center justify-center ${secondaryButtonClass}`}
        onClick={() => onChange(1)}
      >
        <ChevronDoubleLeftIcon className="inline h-4 w-4" />
      </button>
      {page >= 4 && (
        <div className="flex items-center">
          <EllipsisHorizontalIcon className="mx-2 inline h-4 w-4" />
        </div>
      )}
      {pages.map(candidate => (
        <button
          type="button"
          key={candidate}
          className={`px-3 py-1.5 rounded border ${
            candidate === page ? activeButtonClass : secondaryButtonClass
          }`}
          onClick={() => onChange(candidate)}
        >
          {candidate}
        </button>
      ))}
      {page + 3 <= maxPage && (
        <div className="flex items-center">
          <EllipsisHorizontalIcon className="mx-2 inline h-4 w-4" />
        </div>
      )}
      <button
        type="button"
        title="Last page"
        className={`px-3 py-1 rounded flex items-center justify-center ${secondaryButtonClass}`}
        onClick={() => onChange(maxPage)}
      >
        <ChevronDoubleRightIcon className="inline h-4 w-4" />
      </button>
    </div>
  );
};

const verdictBucket: Record<SubmissionOutcome, SubmissionStatus> = {
  accepted: 'accepted',
  'submission-error': 'error',
  untried: 'untried',
  incorrect: 'incorrect',
  'compile-error': 'incorrect',
  'runtime-error': 'incorrect',
  'time-limit': 'incorrect',
  'memory-limit': 'incorrect',
  partial: 'incorrect',
};

const fetchRecentFiles = async (
  fromTime: number,
  signal: AbortSignal
): Promise<MainFileData[]> => {
  const filesObj: { [key: string]: Partial<FileData> } | null = (
    await get(
      query(
        ref(db, 'files'),
        orderByChild('teacher/editTime'),
        startAt(fromTime)
      )
    )
  ).val();
  // Firebase reads can't be aborted, but a stale request skips the per-file reads
  signal.throwIfAborted();
  // If no files match the selected time range, the query returns null
  if (!filesObj) return [];

  const recentFiles = Object.entries(filesObj).flatMap(([fileID, fileData]) => {
    const owner = Object.values(fileData.users ?? {}).find(
      user => user.permission === 'OWNER'
    );
    const editTime = fileData.teacher?.editTime;
    return owner && editTime && editTime >= fromTime
      ? [{ fileID, fileData, owner: owner.name, editTime }]
      : [];
  });

  return Promise.all(
    recentFiles.map(async ({ fileID, fileData, owner, editTime }) => {
      const submission: StatusData | null = (
        await get(ref(db, `submissions/${fileID}/statusData`))
      ).val();

      const submissionStatus: SubmissionStatus = !submission
        ? 'untried'
        : isSubmissionPending(submission)
          ? 'pending'
          : verdictBucket[getSubmissionOutcome(submission)];
      const display = submission
        ? getSubmissionStatusDisplay(submission)
        : getOutcomeDisplay('untried');
      return {
        workspaceName:
          fileData.settings?.workspaceName?.trim() || '(Unnamed Workspace)',
        owner,
        fileID,
        submissionStatus,
        hasProblem: !!fileData.problem,
        lastVerdict: submission?.message || display.label,
        display,
        lastEdit: editTime,
        codeSize: fileData.teacher!.codeSize,
      };
    })
  );
};

const PageContent = () => {
  const [lastEditLabel, setLastEditLabel] = useState(TIME_RANGES[0].label);
  const [showVerdict, setShowVerdict] = useState<ShowVerdict>(allVerdicts);
  const [showNoProblem, setShowNoProblem] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState({ column: 0, descending: false });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  // Tagged with the request it answers, so a newer request reads as loading
  const [loaded, setLoaded] = useState<{
    lastEditLabel: string;
    refreshCount: number;
    files: MainFileData[];
    error: boolean;
  } | null>(null);
  const files = loaded?.files ?? null;
  const loading =
    loaded?.lastEditLabel !== lastEditLabel ||
    loaded.refreshCount !== refreshCount;
  const refreshing = loading && files !== null;
  const timeRange =
    TIME_RANGES.find(range => range.label === lastEditLabel) ?? TIME_RANGES[0];
  const filtersActive =
    searchInput !== '' ||
    !showNoProblem ||
    SUBMISSION_STATUS.some(status => !showVerdict[status]);

  useEffect(() => {
    const controller = new AbortController();

    fetchRecentFiles(Date.now() - timeRange.ms, controller.signal).then(
      newFiles => {
        if (controller.signal.aborted) return;
        setLoaded({
          lastEditLabel,
          refreshCount,
          files: newFiles,
          error: false,
        });
      },
      error => {
        if (controller.signal.aborted) return;
        console.error('Failed to load recent files', error);
        setLoaded(prev => ({
          lastEditLabel,
          refreshCount,
          files: prev?.files ?? [],
          error: true,
        }));
      }
    );

    return () => controller.abort();
  }, [lastEditLabel, timeRange.ms, refreshCount]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
    }, 100);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  const shownFiles = useMemo(() => {
    if (!files) return [];
    const searchTerm = search.trim().toLowerCase();
    return files
      .filter(
        fileData =>
          (fileData.hasProblem || showNoProblem) &&
          showVerdict[fileData.submissionStatus] &&
          (fileData.workspaceName.toLowerCase().includes(searchTerm) ||
            fileData.owner.toLowerCase().includes(searchTerm))
      )
      .sort((a, b) => {
        const res = columns[sort.column].compare(a, b);
        return sort.descending ? -res : res;
      });
  }, [files, search, showNoProblem, showVerdict, sort]);
  const maxPage = Math.max(1, Math.ceil(shownFiles.length / maxPageLength));
  // Clamped so a refresh that shrinks the list keeps a valid page
  const page = Math.min(currentPage, maxPage);

  const changeSorting = (column: number) => {
    setSort(prev => ({
      column,
      descending: prev.column === column && !prev.descending,
    }));
  };
  const selectTimeRange = (label: string) => {
    setLastEditLabel(label);
    setCurrentPage(1);
  };
  const toggleVerdict = (status: SubmissionStatus) => {
    setShowVerdict(prev => ({ ...prev, [status]: !prev[status] }));
    setCurrentPage(1);
  };
  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setShowVerdict(allVerdicts);
    setShowNoProblem(true);
    setCurrentPage(1);
  };

  const pageContent = shownFiles.slice(
    maxPageLength * (page - 1),
    maxPageLength * page
  );
  const rangeStart = maxPageLength * (page - 1) + 1;

  return (
    <div className="w-full theme-text mx-auto pt-4 pb-4 max-w-7xl">
      <div className="mx-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-auto sm:min-w-[12rem] sm:flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 theme-text-muted" />
            <input
              type="search"
              placeholder="Search owner or workspace"
              className="w-full theme-input text-sm rounded-md py-1.5 pl-8"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <div className="flex flex-1 sm:flex-none divide-x divide-[color:var(--border-color)] overflow-hidden rounded-md border theme-border text-sm">
            {TIME_RANGES.map(range => (
              <button
                type="button"
                key={range.label}
                title={`Edited in ${range.phrase}`}
                onClick={() => selectTimeRange(range.label)}
                className={`flex-1 px-2.5 py-1.5 sm:flex-none ${focusRingClass} ${
                  range.label === lastEditLabel
                    ? activeButtonClass
                    : 'text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)]'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <RefreshButton
            onClick={() => setRefreshCount(count => count + 1)}
            isLoading={loading}
            title="Refresh recent activity"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {SUBMISSION_STATUS.map(status => (
            <FilterChip
              key={status}
              pressed={showVerdict[status]}
              onClick={() => toggleVerdict(status)}
            >
              <StatusIcon
                display={verdictChips[status].display}
                className="h-3.5 w-3.5"
              />
              {verdictChips[status].label}
            </FilterChip>
          ))}
          <FilterChip
            pressed={showNoProblem}
            onClick={() => {
              setShowNoProblem(val => !val);
              setCurrentPage(1);
            }}
          >
            Missing problem
          </FilterChip>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className={`rounded px-1.5 py-1 text-xs text-[color:var(--accent-hover)] hover:underline ${focusRingClass}`}
            >
              Clear filters
            </button>
          )}
        </div>
        {loaded?.error && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-status-danger bg-status-danger-surface px-3 py-2 text-sm text-status-danger-content">
            Couldn&apos;t load recent activity.
            <button
              type="button"
              disabled={loading}
              onClick={() => setRefreshCount(count => count + 1)}
              className={`rounded px-3 py-1 disabled:opacity-50 ${secondaryButtonClass}`}
            >
              Retry
            </button>
          </div>
        )}
        <div
          className={`mt-3 border theme-border overflow-x-auto theme-surface ${
            refreshing ? 'border-opacity-75' : 'border-opacity-100'
          } relative z-0`}
        >
          {refreshing && (
            <div className="absolute w-8 h-8 top-1/2 left-1/2 -mt-4 -ml-4 opacity-90 z-10">
              <LoadingIndicator />
            </div>
          )}
          <table
            className={`table-auto w-full theme-table divide-y divide-[color:var(--border-color)] text-sm ${
              refreshing ? 'opacity-60 pointer-events-none' : 'opacity-100'
            } transition duration-200`}
          >
            <thead>
              <tr className="theme-table-header divide-x divide-[color:var(--border-color)] select-none">
                {columns.map((column, ind) => (
                  <th
                    key={column.label}
                    className="group p-0 text-left whitespace-nowrap"
                  >
                    <button
                      type="button"
                      onClick={() => changeSorting(ind)}
                      className={`flex w-full items-center gap-2 px-4 py-3 text-left font-[inherit] hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)] ${focusRingClass}`}
                    >
                      <span>{column.label}</span>
                      {sort.column !== ind ? (
                        <ChevronUpDownIcon className="h-4 w-4 opacity-0 group-hover:opacity-40 group-focus-within:opacity-40" />
                      ) : sort.descending ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronUpIcon className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="theme-surface divide-y divide-[color:var(--border-muted)] min-h-[10rem]">
              {files === null &&
                [0, 1, 2, 3, 4].map(row => (
                  <tr
                    key={row}
                    className="divide-x divide-[color:var(--border-muted)]"
                  >
                    {skeletonWidths.map(width => (
                      <td key={width} className="px-4 py-3">
                        <div
                          className={`h-4 max-w-full animate-pulse rounded bg-surface-muted ${width}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              {files !== null && !pageContent.length && !refreshing && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-10 text-center theme-text-muted"
                  >
                    <div className="flex flex-col items-center gap-3">
                      {loaded?.error && !files.length ? (
                        <p>Nothing to show.</p>
                      ) : !files.length ? (
                        <>
                          <p>No activity in {timeRange.phrase}.</p>
                          {timeRange !== widestTimeRange && (
                            <button
                              type="button"
                              onClick={() =>
                                selectTimeRange(widestTimeRange.label)
                              }
                              className={`rounded px-3 py-1 ${secondaryButtonClass} ${focusRingClass}`}
                            >
                              Show last 7 days
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <p>No files match the current filters.</p>
                          <button
                            type="button"
                            onClick={clearFilters}
                            className={`rounded px-3 py-1 ${secondaryButtonClass} ${focusRingClass}`}
                          >
                            Clear filters
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {pageContent.map(data => (
                <tr
                  className="theme-table-row divide-x divide-[color:var(--border-muted)]"
                  key={data.fileID}
                >
                  <td className="p-0 whitespace-nowrap">
                    <a
                      href={`/${data.fileID.slice(1)}`}
                      className="block px-4 py-2 font-medium text-[color:var(--accent-hover)] hover:text-[color:var(--accent)] hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {data.workspaceName}
                    </a>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{data.owner}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`flex items-center gap-1.5 ${data.display.colorClass} ${data.display.standaloneClass}`}
                      title={data.lastVerdict}
                    >
                      <StatusIcon display={data.display} className="h-4 w-4" />
                      {data.display.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <TimeAgoLabel date={new Date(data.lastEdit)} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <CodeSizeLabel size={data.codeSize} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
          <Pagination page={page} maxPage={maxPage} onChange={setCurrentPage} />
          <span className="theme-text-muted">
            {shownFiles.length
              ? `${rangeStart}–${rangeStart + pageContent.length - 1} of ${shownFiles.length}`
              : '0 results'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function RecentsPage() {
  return (
    <>
      <PageTitle>Recent activity</PageTitle>
      <WithTeacherLogin>
        <PageContent />
      </WithTeacherLogin>
    </>
  );
}
