import React, { useState, useEffect } from 'react';
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
import {
  fetchClasses,
  fetchProblems,
  fetchSolutionData,
  ProblemData,
  SolutionData,
} from '../../../pages/teacher';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

const firestore = getFirestore();
const db = getDatabase();

const tabs = [
  { label: 'Classes', value: 'classes' },
  { label: 'Recent', value: 'recent' },
];
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
    <div className="px-3.5 py-3 flex items-center space-x-2 text-sm bg-gray-800">
      <button
        className="flex items-center px-2.5 py-1.5 rounded-md border border-gray-600 bg-gray-800 enabled:hover:border-gray-500 enabled:active:bg-gray-700 disabled:text-gray-400"
        disabled={page === minPage}
        onClick={() => setPage(Math.max(minPage, page - 1))}
      >
        <FontAwesomeIcon
          icon={{ prefix: 'fas', iconName: 'chevron-left' }}
          className="mr-1.5 inline w-3.5 h-3.5"
        />
        Next
      </button>
      <span className="px-2 text-gray-300">{label}</span>
      <button
        className="flex items-center px-2.5 py-1.5 rounded-md border border-gray-600 bg-gray-800 enabled:hover:border-gray-500 enabled:active:bg-gray-700 disabled:text-gray-400"
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
    <div className="border border-gray-700 divide-y divide-gray-600">
      <div className="text-gray-100 px-3.5 py-3">
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
  const { firebaseUser } = useUserContext();
  const [groups, setGroups] = useState<string[]>([]);
  const [groupInd, setGroupInd] = useState(0);
  const [classInd, setClassInd] = useState(0);
  const [classes, setClasses] = useState<string[]>([]);
  const [problems, setProblems] = useState<ProblemData[]>([]);
  const [data, setData] = useState<(SolutionData | null)[]>([]);

  useEffect(() => {
    if (!firebaseUser) {
      return;
    }
    const updateGroups = async () => {
      const newGroups: string[] | undefined = (
        await getDoc(doc(firestore, 'userdata', firebaseUser.uid))
      ).data()?.groups;

      if (!newGroups) {
        return;
      }
      setGroups(newGroups);
    };
    updateGroups();
  }, [firebaseUser]);

  useEffect(() => {
    if (groups.length === 0) return;

    handleRefresh();
  }, [groupInd, groups, classInd]);

  useEffect(() => {
    if (groups.length === 0) return;

    fetchClasses(groups[groupInd]).then(res => {
      setClasses(res);
    });
    const timeout = setInterval(() => {
      handleRefresh();
    }, 15000);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (groups.length === 0) return;

    const updateProblems = async () => {
      setProblems(await fetchProblems(groups[groupInd], classes[classInd]));
    };
    updateProblems();
  }, [classes]);

  useEffect(() => {
    if (groups.length === 0) return;

    const updateData = async () => {
      const problemsPromise = Promise.all(
        problems
          .filter(problem => problem.platform && problem.id)
          .map(problem => {
            return fetchSolutionData(
              problem.platform!,
              problem.id!,
              firebaseUser.uid
            );
          })
      );
      setData(await problemsPromise);
    };
    updateData();
  }, [problems]);

  const handleRefresh = async () => {
    setClasses(await fetchClasses(groups[groupInd]));
  };

  return (
    <div className="divide-y divide-gray-600 border border-gray-700">
      <div className="flex items-center px-3.5 py-3 space-x-3">
        <Dropdown
          items={groups}
          label={'Group'}
          selected={groupInd}
          setSelected={(index: number) => setGroupInd(index)}
        />
        <Dropdown
          items={classes}
          label={'Class'}
          selected={classInd}
          setSelected={(index: number) => setClassInd(index)}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="table-tasks table-fixed w-full text-sm divide-y divide-gray-700 truncate">
          <thead className="bg-gray-800">
            <tr>
              <th className="text-left">Problem</th>
              <th className="text-left">File</th>
              <th className="text-left">Verdict</th>
              <th className="text-left">Last edit</th>
              <th className="text-left">Code size</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 text-gray-300 bg-gray-900">
            {data.map((row, index) => {
              const curProblem = problems[Math.min(index, problems.length - 1)];
              let tempFileID = 'Tap to Create';
              let tempFileIDhref = `/solve/${curProblem.platform}/${curProblem.id}`;
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
              }
              return (
                <tr key={index}>
                  <td className="truncate">
                    <a
                      href={problems[Math.min(index, problems.length - 1)].url}
                      target="_blank"
                      className="underline text-white hover:text-indigo-200"
                      rel="noreferrer"
                    >
                      {problems[Math.min(index, problems.length - 1)].source}
                    </a>
                  </td>
                  <td>
                    <a
                      className="underline text-white hover:text-indigo-200 mr-2"
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
        setPage={(val: number) => setClassInd(val)}
        minPage={0}
        maxPage={Math.max(0, classes.length - 1)}
        label={`Class: ${classes[classInd] ?? '-'}`}
      />
    </div>
  );
};

export default function Dashboard() {
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [tab, setTab] = useState('classes');

  return (
    <div>
      <div className="flex items-center space-x-4">
        <Link
          href="/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1E1E1E] focus:ring-indigo-500"
        >
          Create New File
        </Link>
      </div>

      <div className="h-8"></div>

      <h2 className="text-gray-200 text-xl font-black mb-5 flex items-center">
        Your workspaces
        <FontAwesomeIcon
          icon={{ prefix: 'fas', iconName: 'computer' }}
          className="ml-2 inline w-6 h-6"
        />
      </h2>
      <TabBar
        tabs={tabs}
        activeTab={tab}
        onTabSelect={tab => {
          setTab(tab.value);
        }}
        homepage={true}
      />
      {tab === 'classes' && <ClassesTab />}
      {tab === 'recent' && (
        <RecentTab
          showHidden={showHidden}
          toggleShowHidden={() => setShowHidden(val => !val)}
        />
      )}
    </div>
  );
}
