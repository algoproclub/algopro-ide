import React, { useEffect, useState } from 'react';
import {
  getDatabase,
  ref,
  orderByChild,
  query,
  onValue,
  off,
  get,
  limitToLast,
} from 'firebase/database';
import FilesList, { File } from './FilesList';
import { useUserContext } from '../../context/UserContext';
import Link from 'next/link';
import { TabBar } from '../TabBar';
import {
  AcademicCapIcon,
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ComputerDesktopIcon,
  PlusIcon,
} from '@heroicons/react/24/solid';
import {
  AcademicCapIcon as AcademicCapOutlineIcon,
  ComputerDesktopIcon as ComputerDesktopOutlineIcon,
} from '@heroicons/react/24/outline';
import Checkbox from '../Checkbox';
import Dropdown from '../Dropdown';
import TimeAgoLabel from '../TimeStamp';
import RefreshButton from '../RefreshButton';
import CodeSizeLabel from '../TaskStatus/CodeSizeLabel';
import TaskStatusIndicator from '../TaskStatus/TaskStatusIndicator';
import { useDashboardClassroom } from '../../hooks/useDashboardClassroom';
import { useStudentTaskStatuses } from '../../hooks/useStudentTaskStatuses';
import { getClassContext, getTaskRef } from '../../scripts/getTaskRef';

const db = getDatabase();

const PAGE_SIZE = 8;

const TaskFileLink = ({
  href,
  children,
}: {
  href: React.ComponentProps<typeof Link>['href'];
  children: React.ReactNode;
}) => (
  <Link href={href} className="relative z-10" target="_blank" prefetch={false}>
    {children}
  </Link>
);

const Pagination = ({
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
}) => {
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
};

const RecentTab = ({
  showHidden,
  toggleShowHidden,
}: {
  showHidden: boolean;
  toggleShowHidden: () => void;
}) => {
  const { firebaseUser } = useUserContext();
  const [page, setPage] = useState(1);
  const [files, setFiles] = useState<File[] | null>(null);
  const [allFiles, setAllFiles] = useState<File[]>([]);
  const maxPage = Math.max(1, Math.ceil(allFiles.length / PAGE_SIZE));
  const currentPage = Math.min(page, maxPage);

  useEffect(() => {
    if (!firebaseUser) return;

    const dbRef = ref(db, `users/${firebaseUser.uid}/files`);
    // TODO: Implement proper pagination on the query level instead of just cutting down the results to 100.
    const fileQuery = query(
      dbRef,
      orderByChild('lastAccessTime'),
      limitToLast(100)
    );

    onValue(fileQuery, snap => {
      if (!snap.exists) {
        setAllFiles([]);
      } else {
        const allFiles: File[] = [];
        snap.forEach(file => {
          const data = file.val();
          if (showHidden || !data.hidden) {
            allFiles.push({ id: file.key, ...data });
          }
        });
        setAllFiles(allFiles.reverse());
      }
    });
    return () => {
      off(fileQuery, 'value');
    };
  }, [firebaseUser, showHidden]);

  useEffect(() => {
    const getFiles = async () => {
      return await Promise.all(
        allFiles
          .slice(PAGE_SIZE * (currentPage - 1), PAGE_SIZE * currentPage)
          .map(async file => {
            const language = (
              await get(ref(db, `files/${file.id}/settings/language`))
            ).val();
            return {
              ...file,
              language,
            };
          })
      );
    };
    getFiles().then(newFiles => {
      setFiles(newFiles);
    });
  }, [allFiles, currentPage]);

  return (
    <div className="overflow-hidden rounded-b-lg border-x border-b border-line bg-panel-muted text-content">
      <div className="border-b border-line bg-panel-muted px-4 py-3 text-content">
        <Checkbox
          label="Show hidden files"
          checked={showHidden}
          toggleChecked={toggleShowHidden}
        />
      </div>
      {files && <FilesList files={files} />}
      <Pagination
        page={currentPage}
        setPage={(val: number) => setPage(val)}
        minPage={1}
        maxPage={maxPage}
        label={`Page: ${currentPage}`}
      />
    </div>
  );
};

const ClassesTab = () => {
  const { firebaseUser, userRole } = useUserContext();
  const userID = firebaseUser?.uid ?? null;
  const {
    groupID,
    classID,
    groups,
    classes,
    tasks,
    groupsResource,
    classesResource,
    selectGroup,
    selectClass,
    refresh,
  } = useDashboardClassroom({ userID, userRole });
  const selectedGroup = groups.find(group => group.id === groupID);
  const solutions = useStudentTaskStatuses({
    schoolID: selectedGroup?.schoolID ?? null,
    groupID,
    classID,
    userID,
    targets: tasks,
  });
  const showSchoolName = new Set(groups.map(group => group.schoolID)).size > 1;
  const classContext = getClassContext(groupID, classID);
  const groupOptions = groups
    .filter(group => group.inactive !== true)
    .map(group => ({
      value: group.id,
      label: (
        <span className="flex items-center truncate">
          {group.name}
          {showSchoolName && (
            <span className="ml-1.5 inline-flex items-center truncate text-xs theme-text-muted">
              (
              <AcademicCapIcon
                className="mr-1 h-3.5 w-3.5 flex-shrink-0"
                aria-hidden="true"
              />
              {group.schoolName ?? group.schoolID ?? 'unknown'})
            </span>
          )}
        </span>
      ),
    }));

  return (
    <div className="overflow-hidden rounded-b-lg border-x border-b border-line bg-panel-muted text-content">
      <div className="flex items-end gap-3 border-b border-line bg-panel-muted px-4 py-3">
        <Dropdown
          items={groupOptions}
          label={'Group'}
          selected={groupID}
          setSelected={selectGroup}
          placeholder="Select group…"
          emptyLabel="Not a member of any groups"
          disabled={groupsResource.status === 'loading'}
          disabledPlaceholder="Loading groups…"
        />
        <Dropdown
          items={classes}
          label={'Class'}
          selected={classID}
          setSelected={selectClass}
          placeholder="Select class…"
          disabledPlaceholder={
            classesResource.status === 'loading'
              ? 'Loading classes…'
              : 'Select a group first'
          }
          emptyLabel="No classes in this group"
          disabled={!groupID || classesResource.status === 'loading'}
        />
        <RefreshButton
          onClick={refresh}
          title="Refresh tasks"
          isLoading={
            groupsResource.status === 'loading' ||
            classesResource.status === 'loading' ||
            classesResource.isRefreshing
          }
        />
      </div>
      {(groupsResource.status === 'error' ||
        classesResource.status === 'error') && (
        <p className="px-3.5 py-2 text-sm text-danger">
          Groups or classes could not be loaded.
        </p>
      )}
      <div className="w-full max-w-full overflow-x-auto">
        <table className="table-tasks w-full table-fixed border-line bg-canvas text-sm text-content">
          <thead className="border-b border-line bg-panel-muted text-content">
            <tr>
              <th className="ui-table-heading w-10 sm:w-12">#</th>
              <th className="ui-table-heading">Problem</th>
              <th className="ui-table-heading hidden w-[18rem] xl:table-cell">
                Source
              </th>
              <th className="ui-table-heading w-36 sm:w-44">Verdict</th>
              <th className="ui-table-heading hidden w-[9rem] xl:table-cell">
                Last edit
              </th>
              <th className="ui-table-heading hidden w-[7rem] whitespace-nowrap text-right xl:table-cell">
                Code size
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-muted bg-canvas text-content">
            {tasks.map((task, index) => {
              if (!classContext) return null;
              const solutionState = solutions[task.key] ?? {
                status: 'loading',
              };
              const row =
                solutionState.status === 'ready' ? solutionState.data : null;
              const isNewFile =
                solutionState.status === 'ready' && row === null;
              const taskHref = getTaskRef(
                row
                  ? { id: row.fileID.slice(1) }
                  : { platform: task.platform, problemID: task.id },
                classContext
              );
              return (
                <tr
                  key={task.key}
                  className="group relative transition-colors hover:bg-panel-muted focus-within:bg-panel-muted active:bg-surface-hover"
                >
                  <td className="whitespace-nowrap text-sm tabular-nums theme-text-muted">
                    {solutionState.status === 'ready' && (
                      <Link
                        href={taskHref}
                        className="ui-focus absolute inset-0 z-0 focus-visible:ring-inset"
                        target="_blank"
                        prefetch={false}
                      >
                        <span className="sr-only">
                          {row ? 'Open' : 'Create a new file for'} task{' '}
                          {task.title ?? task.source}
                        </span>
                      </Link>
                    )}
                    <span className="text-left">{index + 1}.</span>
                  </td>
                  <td className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium theme-text">
                        {task.title ?? task.source}
                      </span>
                      {isNewFile && (
                        <span className="inline-flex shrink-0 items-center rounded-full border border-line-strong bg-surface-raised px-2 py-0.5 text-xs font-medium text-content-secondary">
                          New file
                        </span>
                      )}
                    </div>
                    <Link
                      href={task.url}
                      className="relative z-10 mt-1 block truncate text-xs theme-text-muted hover:text-accent-hover hover:underline xl:hidden"
                      target="_blank"
                      rel="noopener noreferrer"
                      prefetch={false}
                    >
                      {task.source}
                      <ArrowTopRightOnSquareIcon className="ml-1 inline h-3 w-3" />
                    </Link>
                  </td>
                  <td className="hidden min-w-0 theme-text-muted xl:table-cell">
                    <Link
                      href={task.url}
                      className="relative z-10 hover:text-accent-hover hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      prefetch={false}
                    >
                      {task.source}
                      <ArrowTopRightOnSquareIcon className="ml-1 inline h-3 w-3" />
                    </Link>
                  </td>
                  <td>
                    <TaskStatusIndicator
                      state={solutionState}
                      onTintedBackground
                    />
                    <div className="mt-1 space-y-0.5 text-xs font-normal xl:hidden">
                      <div>
                        {row && row.lastEdit ? (
                          <TaskFileLink href={taskHref}>
                            <TimeAgoLabel date={new Date(row.lastEdit)} />
                          </TaskFileLink>
                        ) : (
                          '—'
                        )}
                      </div>
                      <div className="font-mono tabular-nums">
                        {row ? (
                          <TaskFileLink href={taskHref}>
                            <CodeSizeLabel size={row.codeSize} />
                          </TaskFileLink>
                        ) : (
                          <CodeSizeLabel size={null} />
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap theme-text-muted xl:table-cell">
                    {row && row.lastEdit ? (
                      <TaskFileLink href={taskHref}>
                        <TimeAgoLabel date={new Date(row.lastEdit)} />
                      </TaskFileLink>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="hidden text-right font-mono tabular-nums theme-text-muted xl:table-cell">
                    {row ? (
                      <TaskFileLink href={taskHref}>
                        <CodeSizeLabel size={row.codeSize} />
                      </TaskFileLink>
                    ) : (
                      <CodeSizeLabel size={null} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        page={Math.max(0, classes.indexOf(classID ?? ''))}
        setPage={(val: number) => {
          const nextClassID = classes[val];
          if (nextClassID) {
            selectClass(nextClassID);
          }
        }}
        minPage={0}
        maxPage={Math.max(0, classes.length - 1)}
        label={`Class: ${classID ?? '-'}`}
        pageDirection={-1}
      />
    </div>
  );
};

export default function Dashboard() {
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<'classes' | 'recent'>(
    'classes'
  );
  const ClassesIcon =
    selectedTab === 'classes' ? AcademicCapIcon : AcademicCapOutlineIcon;
  const WorkspacesIcon =
    selectedTab === 'recent' ? ComputerDesktopIcon : ComputerDesktopOutlineIcon;

  return (
    <section className="theme-page" aria-labelledby="workspaces-heading">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h2 id="workspaces-heading" className="theme-text text-xl font-bold">
            Your workspaces
          </h2>
          <p className="mt-1 text-sm theme-text-muted">
            Pick up a class task or return to a recent file.
          </p>
        </div>
        <Link href="/new" className="ui-button-primary">
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          Create New File
        </Link>
      </div>
      <TabBar
        selectedId={selectedTab}
        ariaLabel="Dashboard views"
        onSelectionChange={setSelectedTab}
        listClassName="gap-5 border-b border-line px-1"
        tabClassName="px-1 py-2.5 text-sm font-semibold"
        activeTabClassName="border-content-secondary text-content"
      >
        <TabBar.Item
          id="classes"
          label={
            <span className="inline-flex items-center gap-2">
              <ClassesIcon className="h-4 w-4" aria-hidden="true" />
              Classes
            </span>
          }
        >
          <ClassesTab />
        </TabBar.Item>
        <TabBar.Item
          id="recent"
          label={
            <span className="inline-flex items-center gap-2">
              <WorkspacesIcon className="h-4 w-4" aria-hidden="true" />
              Workspaces
            </span>
          }
        >
          <RecentTab
            showHidden={showHidden}
            toggleShowHidden={() => setShowHidden(value => !value)}
          />
        </TabBar.Item>
      </TabBar>
    </section>
  );
}
