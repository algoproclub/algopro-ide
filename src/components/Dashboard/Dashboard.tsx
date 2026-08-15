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
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  AcademicCapIcon,
  PlusIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/20/solid';
import Checkbox from '../Checkbox';
import Dropdown from '../Dropdown';
import TimeAgoLabel from '../TimeStamp';
import RefreshButton from '../RefreshButton';
import CodeSizeLabel from '../TaskStatus/CodeSizeLabel';
import TaskStatusIndicator from '../TaskStatus/TaskStatusIndicator';
import { useDashboardClassroom } from '../../hooks/useDashboardClassroom';
import { useStudentTaskStatuses } from '../../hooks/useStudentTaskStatuses';

const db = getDatabase();

const PAGE_SIZE = 8;

const TaskFileLink = ({
  href,
  children,
}: {
  href: string;
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
}: {
  page: number;
  setPage: (_: number) => void;
  minPage: number;
  maxPage: number;
  label: string;
}) => {
  return (
    <div className="px-3.5 py-3 flex items-center space-x-2 text-sm theme-surface-raised">
      <button
        className="flex items-center px-2.5 py-1.5 rounded-md border theme-button-secondary enabled:hover:border-[color:var(--border-strong)] enabled:active:bg-[color:var(--surface-active)] disabled:text-[color:var(--text-disabled)]"
        disabled={page === minPage}
        onClick={() => setPage(Math.max(minPage, page - 1))}
      >
        <FontAwesomeIcon
          icon={{ prefix: 'fas', iconName: 'chevron-left' }}
          className="mr-1.5 inline w-3.5 h-3.5"
        />
        Next
      </button>
      <span className="px-2 theme-text-muted">{label}</span>
      <button
        className="flex items-center px-2.5 py-1.5 rounded-md border theme-button-secondary enabled:hover:border-[color:var(--border-strong)] enabled:active:bg-[color:var(--surface-active)] disabled:text-[color:var(--text-disabled)]"
        disabled={page === maxPage}
        onClick={() => setPage(Math.min(page + 1, maxPage))}
      >
        Previous
        <FontAwesomeIcon
          icon={{ prefix: 'fas', iconName: 'chevron-right' }}
          className="ml-1.5 inline w-3.5 h-3.5"
        />
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
    <div className="border theme-border divide-y divide-[color:var(--border-muted)] theme-surface">
      <div className="theme-text px-3.5 py-3">
        <Checkbox
          label="Show hidden files"
          checked={showHidden}
          toggleChecked={toggleShowHidden}
        />
      </div>
      {files && <FilesList files={files} showPerms={false} />}
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
  const groupOptions = groups.map(group => ({
    value: group.id,
    label: (
      <span className="flex items-center truncate">
        <span className={group.inactive ? 'theme-text-muted' : ''}>
          {group.name}
        </span>
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
    <div className="divide-y divide-[color:var(--border-muted)] border theme-border theme-surface">
      <div className="flex items-end px-3.5 py-3 space-x-3">
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
        <p className="px-3.5 py-2 text-sm text-[color:var(--danger)]">
          Groups or classes could not be loaded.
        </p>
      )}
      <div className="w-full max-w-full overflow-x-auto">
        <table className="table-tasks w-full table-fixed text-sm divide-y divide-[color:var(--border-muted)] theme-table">
          <thead className="theme-table-header">
            <tr>
              <th className="w-10 text-left text-sm font-bold theme-text sm:w-12">
                #
              </th>
              <th className="text-left text-sm font-bold theme-text">
                Problem
              </th>
              <th className="hidden w-[18rem] text-left text-sm font-bold theme-text xl:table-cell">
                Source
              </th>
              <th className="w-36 text-left text-sm font-bold theme-text sm:w-44">
                Verdict
              </th>
              <th className="hidden w-[9rem] text-left text-sm font-bold theme-text xl:table-cell">
                Last edit
              </th>
              <th className="hidden w-[7rem] whitespace-nowrap text-right text-sm font-bold theme-text xl:table-cell">
                Code size
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border-muted)] theme-table theme-surface-muted">
            {tasks.map((task, index) => {
              const solutionState = solutions[task.key] ?? {
                status: 'loading',
              };
              const row =
                solutionState.status === 'ready' ? solutionState.data : null;
              const isNewFile =
                solutionState.status === 'ready' && row === null;
              const tempFileIDhref = row
                ? `/${row.fileID.slice(1)}`
                : `/solve/${task.platform}/${task.id}`;
              return (
                <tr
                  key={task.key}
                  className="relative group hover:bg-[color:var(--surface-hover)] focus-within:bg-[color:var(--surface-hover)] transition"
                >
                  <td className="whitespace-nowrap text-sm tabular-nums theme-text-muted">
                    {solutionState.status === 'ready' && (
                      <Link
                        href={tempFileIDhref}
                        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--accent)]"
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
                        <span className="inline-flex shrink-0 items-center rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-xs font-medium text-[color:var(--text-inverted)]">
                          <PlusIcon className="mr-1 h-3 w-3" />
                          New file
                        </span>
                      )}
                    </div>
                    <Link
                      href={task.url}
                      className="relative z-10 mt-1 block truncate text-xs theme-text-muted hover:text-[color:var(--accent-hover)] hover:underline xl:hidden"
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
                      className="relative z-10 hover:text-[color:var(--accent-hover)] hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      prefetch={false}
                    >
                      {task.source}
                      <ArrowTopRightOnSquareIcon className="ml-1 inline w-3 h-3" />
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
                          <TaskFileLink href={tempFileIDhref}>
                            <TimeAgoLabel date={new Date(row.lastEdit)} />
                          </TaskFileLink>
                        ) : (
                          '—'
                        )}
                      </div>
                      <div className="font-mono tabular-nums">
                        {row ? (
                          <TaskFileLink href={tempFileIDhref}>
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
                      <TaskFileLink href={tempFileIDhref}>
                        <TimeAgoLabel date={new Date(row.lastEdit)} />
                      </TaskFileLink>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="hidden text-right font-mono tabular-nums theme-text-muted xl:table-cell">
                    {row ? (
                      <TaskFileLink href={tempFileIDhref}>
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
      />
    </div>
  );
};

export default function Dashboard() {
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<'classes' | 'recent'>(
    'classes'
  );

  return (
    <div className="theme-page">
      <div className="flex items-center space-x-4">
        <Link
          href="/new"
          className="inline-flex items-center px-4 py-2 border text-base font-medium rounded-md shadow-sm theme-button-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--app-bg)] focus:ring-[color:var(--accent)]"
        >
          Create New File
        </Link>
      </div>

      <div className="h-8"></div>

      <h2 className="theme-text text-xl font-black mb-5 flex items-center">
        Your workspaces
        <FontAwesomeIcon
          icon={{ prefix: 'fas', iconName: 'computer' }}
          className="ml-2 inline w-6 h-6"
        />
      </h2>
      <TabBar
        selectedId={selectedTab}
        ariaLabel="Dashboard views"
        onSelectionChange={setSelectedTab}
        listClassName="space-x-1"
        tabClassName="rounded-t-md"
        activeTabClassName="bg-[var(--surface-active)] text-[color:var(--text-primary)]"
      >
        <TabBar.Item id="classes" label="Classes">
          <ClassesTab />
        </TabBar.Item>
        <TabBar.Item id="recent" label="Recent">
          <RecentTab
            showHidden={showHidden}
            toggleShowHidden={() => setShowHidden(value => !value)}
          />
        </TabBar.Item>
      </TabBar>
    </div>
  );
}
