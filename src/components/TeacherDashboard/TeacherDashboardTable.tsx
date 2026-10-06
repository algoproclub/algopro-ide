import classNames from 'classnames';
import { ArrowTopRightOnSquareIcon as SmallArrowTopRightOnSquareIcon } from '@heroicons/react/16/solid';
import {
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/20/solid';
import Link from 'next/link';
import {
  CSSProperties,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  type DashboardTask,
  formatClassTaskID,
  Student,
} from '../../data/classroomMetadata';
import { ClassTaskSummary, TaskStatusState } from '../../data/taskStatus';
import CodeSizeLabel from '../TaskStatus/CodeSizeLabel';
import TaskStatusIndicator from '../TaskStatus/TaskStatusIndicator';
import { getTaskStatusDisplay } from '../TaskStatus/statusDisplay';
import TimeAgoLabel from '../TimeStamp';
import styles from './TeacherDashboardTable.module.css';

type CellSelection = {
  studentID: string;
  taskKey: string;
};

const MINUTE = 60_000;
const WEEK = 7 * 24 * 60 * MINUTE;

const useVisibleStudents = (
  students: Student[],
  tasks: DashboardTask[],
  summary: ClassTaskSummary | null,
  timeWindow: number
) => {
  const [, expireStudent] = useState(0);
  // Time is the external input to this filter; the effect below schedules the
  // next render at the exact point when its result will change.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  let nextExpiry = Infinity;
  let isFiltering = summary === null && students.length > 0 && tasks.length > 0;
  const visibleStudents = summary
    ? students.filter(student => {
        let latestEdit = 0;
        let hasUnavailableStatus = false;
        for (const task of tasks) {
          const state = summary[student.id]?.[task.key];
          if (!state || state.status === 'loading') {
            isFiltering = true;
            return false;
          }
          if (state.status === 'error') {
            hasUnavailableStatus = true;
            continue;
          }
          latestEdit = Math.max(latestEdit, state.data?.lastEdit ?? 0);
        }
        if (hasUnavailableStatus) return true;
        if (!latestEdit || !Number.isFinite(timeWindow)) return latestEdit > 0;
        const expiresAt = latestEdit + timeWindow;
        if (expiresAt <= now) return false;
        nextExpiry = Math.min(nextExpiry, expiresAt);
        return true;
      })
    : [];

  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return;
    const timeout = window.setTimeout(
      () => expireStudent(version => version + 1),
      Math.max(0, nextExpiry - Date.now() + 1)
    );
    return () => window.clearTimeout(timeout);
  }, [nextExpiry]);

  return { visibleStudents, isFiltering };
};

const fileHref = (fileID: string) => `/${fileID.slice(1)}`;

const TaskStatusCell = ({
  state,
  selected,
  highlighted,
  timeWindow,
  row,
  column,
  onSelect,
  onOpen,
  onKeyDown,
}: {
  state: TaskStatusState | undefined;
  selected: boolean;
  highlighted: boolean;
  timeWindow: number;
  row: number;
  column: number;
  onSelect: () => void;
  onOpen?: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) => {
  const displayState = state ?? { status: 'loading' as const };
  const status = displayState.status === 'ready' ? displayState.data : null;
  const fadeDuration = Number.isFinite(timeWindow) ? timeWindow : WEEK;
  const [mountedAt] = useState(Date.now);
  const statusDisplay = getTaskStatusDisplay(displayState, 'accent');

  return (
    <button
      type="button"
      data-cell-row={row}
      data-cell-column={column}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onFocus={onSelect}
      style={
        status
          ? ({
              '--status-fade-delay': `${status.lastEdit - mountedAt}ms`,
              '--status-fade-duration': `${fadeDuration}ms`,
              '--status-fade-steps': fadeDuration / MINUTE,
            } as CSSProperties)
          : undefined
      }
      tabIndex={selected ? 0 : -1}
      onKeyDown={event => {
        if (event.key === 'Enter' && onOpen) {
          event.preventDefault();
          onOpen();
          return;
        }
        onKeyDown(event);
      }}
      className={classNames(
        'flex h-11 w-full min-w-0 scroll-ml-48 flex-col justify-center gap-0.5 px-2 text-left text-xs focus:outline-none lg:scroll-mr-24',
        styles.statusCell,
        statusDisplay.colorClass,
        status && styles.fading,
        highlighted && styles.highlighted,
        selected && 'z-10 ring-2 ring-inset ring-[color:var(--accent)]'
      )}
    >
      <span className="min-w-0">
        <TaskStatusIndicator
          state={displayState}
          untriedColor="accent"
          onTintedBackground
        />
      </span>
      {status && (
        <span className="theme-text-muted flex min-w-0 items-center justify-between gap-2 pl-[1.375rem] text-[0.6875rem] leading-none tabular-nums">
          <CodeSizeLabel size={status.codeSize} />
          <TimeAgoLabel date={new Date(status.lastEdit)} compact />
        </span>
      )}
    </button>
  );
};

const SelectedTaskDetails = ({
  student,
  task,
  state,
}: {
  student: Student;
  task: DashboardTask;
  state: TaskStatusState | undefined;
}) => {
  const status = state?.status === 'ready' ? state.data : undefined;
  let unavailableText = 'Loading…';
  let unavailableClassName = 'theme-text-muted whitespace-nowrap';
  if (state?.status === 'error') {
    unavailableText = 'Status unavailable';
    unavailableClassName = 'whitespace-nowrap text-[color:var(--danger)]';
  } else if (state?.status === 'ready' && !status) {
    unavailableText = 'No file to open';
  }

  return (
    <div className="theme-surface-raised grid items-center gap-2 border-t border-[color:var(--border-muted)] px-3 py-2 text-sm sm:grid-cols-2 lg:grid-cols-[minmax(9rem,1fr)_minmax(10rem,1.2fr)_minmax(8rem,1fr)_7rem_6rem_auto]">
      <div className="min-w-0">
        <span className="theme-text-muted block text-xs">Student</span>
        <span className="block truncate font-medium">{student.name}</span>
      </div>
      <div className="min-w-0">
        <span className="theme-text-muted block text-xs">Task</span>
        <span className="block truncate font-medium">
          {task.title ?? task.source}
        </span>
      </div>
      <div className="min-w-0">
        <span className="theme-text-muted block text-xs">Status</span>
        <span className="block min-w-0 truncate font-medium">
          <TaskStatusIndicator
            state={state ?? { status: 'loading' }}
            untriedColor="accent"
            onTintedBackground
          />
        </span>
      </div>
      <div className="min-w-0">
        <span className="theme-text-muted block text-xs">Last edit</span>
        <span className="block truncate font-medium">
          {status ? <TimeAgoLabel date={new Date(status.lastEdit)} /> : '—'}
        </span>
      </div>
      <div>
        <span className="theme-text-muted block text-xs">File size</span>
        <span className="font-medium tabular-nums">
          <CodeSizeLabel size={status?.codeSize} />
        </span>
      </div>
      <div className="flex justify-end">
        {status ? (
          <Link
            href={fileHref(status.fileID)}
            target="_blank"
            prefetch={false}
            className="theme-button-primary inline-flex items-center whitespace-nowrap rounded-md px-3 py-1.5 font-medium"
          >
            Open file
            <ArrowTopRightOnSquareIcon className="ml-1.5 h-4 w-4" />
          </Link>
        ) : (
          <span className={unavailableClassName}>{unavailableText}</span>
        )}
      </div>
    </div>
  );
};

export default function TeacherDashboardTable({
  classID,
  groupName,
  tasks,
  students,
  summary,
  timeWindow,
  highlightMostRecent,
  isLoading = false,
  errorMessage,
  emptyStudentMessage,
}: {
  classID: string;
  groupName: string;
  tasks: DashboardTask[];
  students: Student[];
  summary: ClassTaskSummary | null;
  timeWindow: number;
  highlightMostRecent: boolean;
  isLoading?: boolean;
  errorMessage?: string;
  emptyStudentMessage?: string;
}) {
  const scrollContainer = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<CellSelection | null>(null);
  const { visibleStudents, isFiltering } = useVisibleStudents(
    students,
    tasks,
    summary,
    timeWindow
  );
  const selectionIsVisible =
    selection &&
    visibleStudents.some(student => student.id === selection.studentID) &&
    tasks.some(task => task.key === selection.taskKey);
  const selected = selectionIsVisible
    ? selection
    : visibleStudents[0] && tasks[0]
      ? { studentID: visibleStudents[0].id, taskKey: tasks[0].key }
      : null;
  const selectedStudent = selected
    ? visibleStudents.find(student => student.id === selected.studentID)
    : undefined;
  const selectedTask = selected
    ? tasks.find(task => task.key === selected.taskKey)
    : undefined;
  const selectedState =
    selected && summary
      ? summary[selected.studentID]?.[selected.taskKey]
      : undefined;
  const latestEditByStudent = new Map(
    visibleStudents.map(student => [
      student.id,
      Math.max(
        0,
        ...tasks.map(task => {
          const state = summary?.[student.id]?.[task.key];
          return state?.status === 'ready' ? (state.data?.lastEdit ?? 0) : 0;
        })
      ),
    ])
  );

  const scrollCellIntoView = (cell: HTMLButtonElement) => {
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    const container = scrollContainer.current;
    if (!container) return;

    const cellRect = cell.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const headerBottom =
      container.querySelector('thead')?.getBoundingClientRect().bottom ??
      containerRect.top;
    const visibleTop = Math.max(containerRect.top, headerBottom);

    if (cellRect.top < visibleTop) {
      container.scrollTop += cellRect.top - visibleTop;
    } else if (cellRect.bottom > containerRect.bottom) {
      container.scrollTop += cellRect.bottom - containerRect.bottom;
    }
  };

  const moveSelection = (
    event: KeyboardEvent<HTMLButtonElement>,
    row: number,
    column: number
  ) => {
    let nextRow = row;
    let nextColumn = column;
    if (event.key === 'ArrowLeft') nextColumn -= 1;
    else if (event.key === 'ArrowRight') nextColumn += 1;
    else if (event.key === 'ArrowUp') nextRow -= 1;
    else if (event.key === 'ArrowDown') nextRow += 1;
    else return;

    event.preventDefault();
    const student = visibleStudents[nextRow];
    const task = tasks[nextColumn];
    if (!student || !task) return;
    setSelection({ studentID: student.id, taskKey: task.key });
    const nextCell = scrollContainer.current?.querySelector<HTMLButtonElement>(
      `[data-cell-row="${nextRow}"][data-cell-column="${nextColumn}"]`
    );
    nextCell?.focus({ preventScroll: true });
    if (nextCell) scrollCellIntoView(nextCell);
  };

  return (
    <section className="theme-border theme-surface overflow-hidden rounded-lg border">
      <header className="theme-surface-raised flex items-center justify-between gap-3 border-b border-[color:var(--border-muted)] px-3 py-2">
        <div className="min-w-0">
          <h2 className="m-0 truncate text-base font-semibold">
            Class {classID} progress
          </h2>
          <p className="theme-text-muted m-0 text-xs">
            {visibleStudents.length}{' '}
            {visibleStudents.length === 1 ? 'student' : 'students'} ·{' '}
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="theme-button-secondary inline-flex items-center rounded-md px-2.5 py-1.5 text-sm"
            onClick={() =>
              scrollContainer.current?.scrollBy({
                left: -320,
                behavior: 'smooth',
              })
            }
          >
            <ChevronLeftIcon className="mr-1 h-4 w-4" />
            Tasks
          </button>
          <button
            type="button"
            className="theme-button-secondary inline-flex items-center rounded-md px-2.5 py-1.5 text-sm"
            onClick={() =>
              scrollContainer.current?.scrollBy({
                left: 320,
                behavior: 'smooth',
              })
            }
          >
            Tasks
            <ChevronRightIcon className="ml-1 h-4 w-4" />
          </button>
        </div>
      </header>

      {errorMessage ? (
        <div className="px-4 py-12 text-center text-sm text-[color:var(--danger)]">
          {errorMessage}
        </div>
      ) : (isLoading || isFiltering) &&
        (tasks.length === 0 || visibleStudents.length === 0) ? (
        <div className="theme-text-muted px-4 py-12 text-center text-sm">
          Preparing filtered progress…
        </div>
      ) : tasks.length === 0 || visibleStudents.length === 0 ? (
        <div className="theme-text-muted px-4 py-12 text-center text-sm">
          {tasks.length === 0
            ? 'This class has no supported tasks.'
            : (emptyStudentMessage ?? 'This group has no students.')}
        </div>
      ) : (
        <>
          <div
            ref={scrollContainer}
            className="max-h-[40rem] max-w-full overflow-auto"
          >
            <table className="theme-table w-max min-w-full border-separate border-spacing-0 text-sm">
              <thead className="theme-table-header">
                <tr>
                  <th className="theme-table-header sticky left-0 top-0 z-40 h-16 w-48 min-w-[12rem] border-b border-r border-[color:var(--border-muted)] px-3 text-left font-semibold">
                    Student
                  </th>
                  {tasks.map((task, index) => (
                    <th
                      key={task.key}
                      className="theme-table-header sticky top-0 z-30 h-16 w-36 min-w-[9rem] border-b border-r border-[color:var(--border-muted)] px-2 text-left font-normal"
                    >
                      <span className="theme-text-muted block text-xs">
                        {formatClassTaskID(groupName, classID, index)}
                      </span>
                      <span className="theme-text block truncate font-semibold">
                        {task.title ?? task.source}
                      </span>
                      <Link
                        href={task.url}
                        target="_blank"
                        rel="noreferrer"
                        className="theme-text-muted block truncate text-xs hover:text-[color:var(--accent-hover)] hover:underline"
                      >
                        {task.source}
                        <SmallArrowTopRightOnSquareIcon className="ml-1 inline h-3 w-3" />
                      </Link>
                    </th>
                  ))}
                  <th className="theme-table-header sticky top-0 z-40 h-16 w-24 min-w-[6rem] border-b border-l border-[color:var(--border-muted)] px-2 text-left font-semibold lg:right-0">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((student, row) => {
                  const solved = tasks.filter(task => {
                    const state = summary?.[student.id]?.[task.key];
                    return (
                      state?.status === 'ready' &&
                      state.data?.outcome === 'accepted'
                    );
                  }).length;
                  const progress = Math.round((solved / tasks.length) * 100);
                  return (
                    <tr key={student.id}>
                      <th
                        className={classNames(
                          'theme-surface sticky left-0 z-20 h-11 w-48 min-w-[12rem] border-b border-r border-[color:var(--border-muted)] px-3 text-left font-medium',
                          selected?.studentID === student.id &&
                            'bg-[color:var(--surface-hover)]'
                        )}
                      >
                        <Link
                          href={`/user/${student.id}`}
                          prefetch={false}
                          className="block truncate hover:text-accent-hover hover:underline"
                        >
                          {student.name}
                        </Link>
                      </th>
                      {tasks.map((task, column) => {
                        const state = summary
                          ? summary[student.id]?.[task.key]
                          : undefined;
                        const status =
                          state?.status === 'ready' ? state.data : null;
                        const isSelected =
                          selected?.studentID === student.id &&
                          selected.taskKey === task.key;
                        const isMostRecent =
                          !!status &&
                          status.lastEdit ===
                            latestEditByStudent.get(student.id);
                        return (
                          <td
                            key={task.key}
                            className="h-11 w-36 min-w-[9rem] border-b border-r border-[color:var(--border-muted)] p-0"
                          >
                            <TaskStatusCell
                              state={state}
                              selected={isSelected}
                              highlighted={highlightMostRecent && isMostRecent}
                              timeWindow={timeWindow}
                              row={row}
                              column={column}
                              onSelect={() =>
                                setSelection({
                                  studentID: student.id,
                                  taskKey: task.key,
                                })
                              }
                              onOpen={
                                status
                                  ? () =>
                                      window.open(
                                        fileHref(status.fileID),
                                        '_blank',
                                        'noopener,noreferrer'
                                      )
                                  : undefined
                              }
                              onKeyDown={event =>
                                moveSelection(event, row, column)
                              }
                            />
                          </td>
                        );
                      })}
                      <td className="theme-surface h-11 w-24 min-w-[6rem] border-b border-l border-[color:var(--border-muted)] px-2 lg:sticky lg:right-0 lg:z-20">
                        <div className="flex justify-between gap-1 text-xs tabular-nums">
                          <span className="font-semibold">
                            {solved}/{tasks.length}
                          </span>
                          <span className="theme-text-muted">{progress}%</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-[color:var(--surface-bg-muted)]">
                          <div
                            className="h-full rounded-full bg-[color:var(--accent)]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {selectedStudent && selectedTask && (
            <SelectedTaskDetails
              student={selectedStudent}
              task={selectedTask}
              state={selectedState}
            />
          )}
          <div className="theme-text-muted flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border-muted)] px-3 py-1.5 text-xs">
            <span>Select to inspect; double-click to open.</span>
            <span>Arrow keys move · Enter opens.</span>
          </div>
        </>
      )}
    </section>
  );
}
