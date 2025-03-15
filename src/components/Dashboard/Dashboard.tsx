import { useSetAtom } from 'jotai';
import React, { useState, useEffect, Fragment, useRef } from 'react';
import {
  getDatabase,
  ref,
  orderByChild,
  query,
  onValue,
  set,
  child,
  off,
  update,
  push,
  serverTimestamp,
  DataSnapshot,
  get,
} from 'firebase/database';
import {
  signInWithGoogleAtom,
  signOutAtom,
} from '../../atoms/firebaseUserAtoms';
import { useConnectionContext } from '../../context/ConnectionContext';
import { isFirebaseId } from '../../editorUtils';
import FilesList, { File } from './FilesList';
import {
  EditorMode,
  Language,
  useUserContext,
} from '../../context/UserContext';
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
import { Dialog, Transition } from '@headlessui/react';
import SignInSettings from '../settings/SignInSettings';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { updateUserSettings } from '../../scripts/updateSettings';
import { DEFAULT_COMPILER_OPTIONS } from '../../../pages/new';
import va from '@vercel/analytics';
import colorFromUserId from '../../scripts/colorFromUserId';
import { ServerValue } from 'firebase-admin/database';

const firestore = getFirestore();
const db = getDatabase();

const tabs = [
  { label: 'Recent', value: 'recent' },
  { label: 'Classes', value: 'classes' },
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
  console.log(page, minPage, maxPage);
  return (
    <div className="px-3.5 py-3 flex items-center space-x-2 text-sm bg-gray-800">
      <button
        className="flex items-center px-2.5 py-1.5 rounded-md border border-gray-600 bg-gray-800 enabled:hover:border-gray-500 enabled:active:bg-gray-700 disabled:text-gray-400"
        disabled={page === minPage}
        onClick={() => setPage(Math.max(minPage, page - 1))}
      >
        <FontAwesomeIcon
          icon={{ prefix: 'fas', iconName: 'chevron-left' }}
          className="mr-1.5 w-3.5 h-3.5"
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
          className="ml-1.5 w-3.5 h-3.5"
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
    const fileQuery = query(dbRef, orderByChild('lastAccessTime'));

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
  const { firebaseUser, userData } = useUserContext();
  const [groups, setGroups] = useState<string[]>([]);
  const [group, setGroup] = useState(0);
  const [classID, setClassID] = useState(0);
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
  }, [group, groups, classID]);

  useEffect(() => {
    if (groups.length === 0) return;

    fetchClasses(groups[group]).then(res => {
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
      setProblems(await fetchProblems(groups[group], classes[classID]));
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
    setClasses(await fetchClasses(groups[group]));
  };

  return (
    <div className="divide-y divide-gray-600 border border-gray-700">
      <div className="flex items-center px-3.5 py-3 space-x-3">
        <Dropdown
          items={groups}
          label={'Group'}
          selected={group}
          setSelected={(index: number) => setGroup(index)}
        />
        <Dropdown
          items={classes}
          label={'Class'}
          selected={classID}
          setSelected={(index: number) => setClassID(index)}
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
              if (!row) {
                return <Fragment key={index}></Fragment>;
              }
              return (
                <tr key={index}>
                  <td className="truncate">
                    <a
                      href={problems[Math.min(index, problems.length - 1)].url}
                      target="_blank"
                      className="underline text-white hover:text-indigo-200"
                    >
                      {problems[Math.min(index, problems.length - 1)].source}
                    </a>
                  </td>
                  <td>
                    <a
                      className="underline text-white hover:text-indigo-200 mr-2"
                      href={`/${row.fileID.slice(1)}`}
                      target="_blank"
                    >
                      {row.fileID.split('-')[1]}
                    </a>
                  </td>
                  <td>
                    <div className="flex items-center">
                      <span className="mr-1.5">
                        {row.verdict[0].toUpperCase() + row.verdict.slice(1)}
                      </span>
                      <span>
                        {row.verdictType === 'wrong' && (
                          <FontAwesomeIcon
                            icon={{ prefix: 'fas', iconName: 'xmark' }}
                            className="text-red-500"
                          />
                        )}
                        {row.verdictType === 'accepted' && (
                          <FontAwesomeIcon
                            icon={{ prefix: 'fas', iconName: 'check' }}
                            className="text-green-500"
                          />
                        )}
                        {row.verdictType === 'error' && (
                          <FontAwesomeIcon
                            icon={{
                              prefix: 'fas',
                              iconName: 'triangle-exclamation',
                            }}
                            className="text-yellow-500"
                          />
                        )}
                      </span>
                    </div>
                  </td>
                  <td>
                    <TimeAgoLabel date={new Date(row.lastEdit)} />
                  </td>
                  <td>{row.codeSize}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        page={classID}
        setPage={(val: number) => setClassID(val)}
        minPage={0}
        maxPage={Math.max(0, classes.length - 1)}
        label={`Class: ${classes[classID] ?? '-'}`}
      />
    </div>
  );
};

export default function Dashboard() {
  const { firebaseUser, userData } = useUserContext();

  const signInWithGoogle = useSetAtom(signInWithGoogleAtom);
  const signOut = useSetAtom(signOutAtom);

  const connectionContext = useConnectionContext();
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState('recent');

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

      <h2 className="text-gray-200 text-xl font-black mb-5">
        Your workspaces{' '}
        <FontAwesomeIcon
          icon={{ prefix: 'fas', iconName: 'computer' }}
          className="ml-1"
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
      {tab === 'recent' && (
        <RecentTab
          showHidden={showHidden}
          toggleShowHidden={() => setShowHidden(val => !val)}
        />
      )}
      {tab === 'classes' && <ClassesTab />}
    </div>
  );
}
