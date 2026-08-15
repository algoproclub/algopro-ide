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
import Checkbox from '../Checkbox';
import Dropdown from '../Dropdown';
import TimeAgoLabel from '../TimeStamp';
import { useDashboardClassroom } from '../../hooks/useDashboardClassroom';
import { useStudentTaskStatuses } from '../../hooks/useStudentTaskStatuses';
import RefreshButton from '../RefreshButton';

const db = getDatabase();

const PAGE_SIZE = 8;

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
  const [maxPage, setMaxPage] = useState(1);
  const [files, setFiles] = useState<File[] | null>(null);
  const [allFiles, setAllFiles] = useState<File[]>([]);

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
          .slice(PAGE_SIZE * (page - 1), PAGE_SIZE * page)
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
    setMaxPage(Math.max(1, Math.ceil(allFiles.length / PAGE_SIZE)));
    setPage(
      Math.max(1, Math.min(page, Math.ceil(allFiles.length / PAGE_SIZE)))
    );
    getFiles().then(newFiles => {
      setFiles(newFiles);
    });
  }, [allFiles, page]);

  useEffect(() => {
    setPage(Math.min(page, maxPage));
  }, [showHidden]);

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
        page={page}
        setPage={(val: number) => setPage(val)}
        minPage={1}
        maxPage={maxPage}
        label={`Page: ${page}`}
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
  const statuses = useStudentTaskStatuses({
    schoolID: selectedGroup?.schoolID ?? null,
    groupID,
    classID,
    userID,
    targets: tasks,
  });
  const groupInd = Math.max(
    0,
    groups.findIndex(group => group.id === groupID)
  );
  const classInd = Math.max(0, classes.indexOf(classID ?? ''));

  return (
    <div className="divide-y divide-[color:var(--border-muted)] border theme-border theme-surface">
      <div className="flex items-center px-3.5 py-3 space-x-3">
        <Dropdown
          items={groups.map(group => group.name)}
          label={'Group'}
          selected={groupInd}
          setSelected={(index: number) =>
            selectGroup(groups[index]?.id ?? null)
          }
        />
        <Dropdown
          items={classes}
          label={'Class'}
          selected={classInd}
          setSelected={(index: number) => selectClass(classes[index] ?? null)}
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
      <div className="overflow-x-auto">
        <table className="table-tasks table-fixed w-full text-sm divide-y divide-[color:var(--border-muted)] truncate theme-table">
          <thead className="theme-table-header">
            <tr>
              <th className="text-left">Problem</th>
              <th className="text-left">File</th>
              <th className="text-left">Verdict</th>
              <th className="text-left">Last edit</th>
              <th className="text-left">Code size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border-muted)] theme-surface-muted">
            {tasks.map(task => {
              const state = statuses[task.key] ?? { status: 'loading' };
              const row = state.status === 'ready' ? state.data : null;
              let tempFileID = 'Tap to Create';
              let tempFileIDhref = `/solve/${task.platform}/${task.id}`;
              let tempVerdict = 'Untried';
              let tempCodeSize = '';
              if (row) {
                tempFileID = row.fileID.slice(1);
                tempFileIDhref = `/${row.fileID.slice(1)}`;
                tempVerdict =
                  row.verdict[0].toUpperCase() + row.verdict.slice(1);
                tempCodeSize = row.codeSize
                  ? row.codeSize.toString()
                  : 'Unknown';
              } else if (state.status === 'loading') {
                tempFileID = 'Loading…';
                tempVerdict = 'Loading…';
              } else if (state.status === 'error') {
                tempFileID = 'Unavailable';
                tempVerdict = 'Unavailable';
              }
              return (
                <tr key={task.key}>
                  <td className="truncate">
                    <a
                      href={task.url}
                      target="_blank"
                      className="underline theme-text hover:text-[color:var(--accent-hover)]"
                      rel="noreferrer"
                    >
                      {task.source}
                    </a>
                  </td>
                  <td>
                    <a
                      className="underline theme-text hover:text-[color:var(--accent-hover)] mr-2"
                      href={tempFileIDhref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {tempFileID}
                    </a>
                  </td>
                  <td>
                    <div className="flex items-center">
                      <span className="mr-1.5">{tempVerdict}</span>
                      {row && (
                        <span>
                          {row.verdictType === 'wrong' && (
                            <FontAwesomeIcon
                              icon={{ prefix: 'fas', iconName: 'xmark' }}
                              className="inline w-4 h-4 text-red-500"
                            />
                          )}
                          {row.verdictType === 'accepted' && (
                            <FontAwesomeIcon
                              icon={{ prefix: 'fas', iconName: 'check' }}
                              className="inline w-4 h-4 text-green-500"
                            />
                          )}
                          {row.verdictType === 'error' && (
                            <FontAwesomeIcon
                              icon={{
                                prefix: 'fas',
                                iconName: 'triangle-exclamation',
                              }}
                              className="inline w-4 h-4 text-yellow-500"
                            />
                          )}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {row && row.lastEdit ? (
                      <TimeAgoLabel date={new Date(row.lastEdit)} />
                    ) : (
                      'Unknown'
                    )}
                  </td>
                  <td>{row && tempCodeSize}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        page={classInd}
        setPage={(val: number) => selectClass(classes[val] ?? null)}
        minPage={0}
        maxPage={Math.max(0, classes.length - 1)}
        label={`Class: ${classes[classInd] ?? '-'}`}
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
