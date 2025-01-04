import { useSetAtom } from 'jotai';
import React, { useState, useEffect, Fragment, useRef } from 'react';
import {
  getDatabase,
  ref,
  orderByChild,
  query,
  onValue,
  off,
  get,
} from 'firebase/database';
import {
  signInWithGoogleAtom,
  signOutAtom,
} from '../../atoms/firebaseUserAtoms';
import { useConnectionContext } from '../../context/ConnectionContext';
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
import UserSettings from '../settings/UserSettings';
import { Dialog, Transition } from '@headlessui/react';
import SignInSettings from '../settings/SignInSettings';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { updateUserSettings } from '../../scripts/updateSettings';

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
  const { firebaseUser } = useUserContext();
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
                      rel="noreferrer"
                    >
                      {problems[Math.min(index, problems.length - 1)].source}
                    </a>
                  </td>
                  <td>
                    <a
                      className="underline text-white hover:text-indigo-200 mr-2"
                      href={`/${row.fileID.slice(1)}`}
                      target="_blank"
                      rel="noreferrer"
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

const UserSettingsModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [name, setName] = useState<string>('');
  const [cfUsername, setCfUsername] = useState<string>('');
  const [atcoderUsername, setAtcoderUsername] = useState<string>('');
  const [discordID, setDiscordID] = useState<string>('');
  const [defaultLanguage, setDefaultLanguage] = useState<Language>('cpp');
  const [editorMode, setEditorMode] = useState<EditorMode>('Normal');
  const [tabSize, setTabSize] = useState<number>(-1);
  const [lightMode, setLightMode] = useState<boolean>(false);
  const [manualSubmission, setManualSubmission] = useState<boolean>(false);
  const [templateCode, setTemplateCode] = useState<
    Partial<Record<Language, string>>
  >({});
  const [templateLanguage, setTemplateLanguage] = useState<Language>('cpp');
  const dirtyRef = useRef<boolean>(false);

  const {
    userData,
    firebaseUser,
    updateUsername,
    templateCode: savedTemplateCode,
  } = useUserContext();

  useEffect(() => {
    if (isOpen) {
      setName(firebaseUser.displayName ?? '');
      setCfUsername(userData.usernames.codeforces ?? '');
      setAtcoderUsername(userData.usernames.atcoder ?? '');
      setDiscordID(userData.discordID ?? '');
      setDefaultLanguage(userData.defaultLanguage ?? '');
      setEditorMode(userData.editorMode);
      setTabSize(userData.tabSize);
      setLightMode(userData.lightMode);
      setManualSubmission(userData.manualSubmission);
      setTemplateCode(savedTemplateCode);
      dirtyRef.current = false;
    }
  }, [isOpen]);

  const closeWithoutSaving = () => {
    if (dirtyRef.current) {
      if (
        confirm('Are you sure you want to exit without saving your changes?')
      ) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const saveAndClose = async () => {
    if (!name) {
      alert('Username cannot be empty. Fix before saving.');
      return;
    }
    updateUserSettings({
      userID: firebaseUser.uid,
      cfUsername,
      atcoderUsername,
      defaultLanguage,
      discordID,
      editorMode,
      tabSize,
      lightMode,
      manualSubmission,
      templateCode,
    });
    if (name !== firebaseUser.displayName) {
      await updateUsername(name);
    }
    onClose();
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        static
        className="fixed z-10 inset-0 overflow-y-auto"
        open={isOpen}
        onClose={closeWithoutSaving}
      >
        <div className="flex items-end justify-center min-h-full pt-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="inline-block bg-gray-800 md:rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl w-full">
              <div className="px-4 sm:px-6 pt-4 pb-2">
                <Dialog.Title
                  as="h3"
                  className="text-lg leading-6 font-medium text-center"
                >
                  User settings
                </Dialog.Title>
              </div>
              <div className="p-4 sm:p-6 space-y-3">
                <UserSettings
                  name={name}
                  onNameChange={name => {
                    setName(name);
                    dirtyRef.current = true;
                  }}
                  cfUsername={cfUsername}
                  onCfUsernameChange={cfUsername => {
                    setCfUsername(cfUsername);
                    dirtyRef.current = true;
                  }}
                  atcoderUsername={atcoderUsername}
                  onAtcoderUsernameChange={atcoderUsername => {
                    setAtcoderUsername(atcoderUsername);
                    dirtyRef.current = true;
                  }}
                  discordID={discordID}
                  onDiscordIDChange={discordID => {
                    setDiscordID(discordID);
                    dirtyRef.current = true;
                  }}
                  defaultLanguage={defaultLanguage}
                  onDefaultLanguageChange={language => {
                    setDefaultLanguage(language);
                    dirtyRef.current = true;
                  }}
                  editorMode={editorMode}
                  onEditorModeChange={mode => {
                    setEditorMode(mode);
                    dirtyRef.current = true;
                  }}
                  tabSize={tabSize}
                  onTabSizeChange={size => {
                    setTabSize(size);
                    dirtyRef.current = true;
                  }}
                  lightMode={lightMode}
                  onLightModeChange={lightMode => {
                    setLightMode(lightMode);
                    dirtyRef.current = true;
                  }}
                  manualSubmission={manualSubmission}
                  onManualSubmissionChange={manualSubmission => {
                    setManualSubmission(manualSubmission);
                    dirtyRef.current = true;
                  }}
                  templateCode={templateCode}
                  onTemplateCodeChange={code => {
                    setTemplateCode(code);
                    dirtyRef.current = true;
                  }}
                  language={templateLanguage}
                  onLanguageChange={setTemplateLanguage}
                />
                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-700 shadow-sm text-[0.92rem] font-medium rounded-md text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onClick={closeWithoutSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onClick={saveAndClose}
                  >
                    Save
                  </button>
                </div>
                <hr className="border-gray-700" />
                <SignInSettings />
              </div>
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="rounded-md text-gray-200 hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onClick={closeWithoutSaving}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default function Dashboard() {
  const { firebaseUser } = useUserContext();

  const signInWithGoogle = useSetAtom(signInWithGoogleAtom);
  const signOut = useSetAtom(signOutAtom);

  const connectionContext = useConnectionContext();
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState('recent');

  return (
    <div>
      <UserSettingsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
      {firebaseUser.isAnonymous ? (
        <div className="text-gray-400 mb-6">
          Not signed in.{' '}
          <div className="flex-col space-y-2.5 p-2">
            <button
              className="underline text-gray-300 focus:outline-none hover:text-indigo-200 text-[0.95rem]"
              onClick={() => signInWithGoogle(connectionContext)}
            >
              <FontAwesomeIcon
                icon={{ prefix: 'fas', iconName: 'sign-in' }}
                className="mr-2"
              />
              Sign in
            </button>
          </div>
        </div>
      ) : (
        <div className="text-gray-400 mb-4">
          Signed in as {firebaseUser.displayName}.
          <div className="flex-col space-y-2.5 p-2">
            <button
              className="block underline text-gray-300 hover:text-indigo-200 focus:outline-none leading-none text-[0.95rem]"
              onClick={() => signOut(connectionContext)}
            >
              <FontAwesomeIcon
                icon={{ prefix: 'fas', iconName: 'sign-out' }}
                className="mr-2"
              />
              Sign out
            </button>
            <button
              className="block underline text-gray-300 hover:text-indigo-200 focus:outline-none leading-none text-[0.95rem]"
              onClick={() => setIsOpen(val => !val)}
            >
              <FontAwesomeIcon
                icon={{ prefix: 'fas', iconName: 'cog' }}
                className="mr-2"
              />
              Settings
            </button>
          </div>
        </div>
      )}

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
