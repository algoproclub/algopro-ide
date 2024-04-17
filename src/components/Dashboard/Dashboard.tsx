import { useUpdateAtom } from 'jotai/utils';
import { useRouter } from 'next/router';
import React, { useState, useEffect } from 'react';
import {
  getDatabase,
  ref,
  orderByChild,
  query,
  onValue,
  set,
  child,
  off,
} from 'firebase/database';
import {
  signInWithGoogleAtom,
  signOutAtom,
} from '../../atoms/firebaseUserAtoms';
import { useConnectionContext } from '../../context/ConnectionContext';
import { isFirebaseId } from '../../editorUtils';
import FilesList, { File } from './FilesList';
import { RadioGroupContents } from '../settings/RadioGroupContents';
import { useUserContext } from '../../context/UserContext';
import Link from 'next/link';
import { TabBar } from '../TabBar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Checkbox from '../Checkbox';
import Dropdown from '../Dropdown';
import TimeAgoLabel from '../TimeStamp';

const tabs = [
  { label: 'Recent', value: 'recent' },
  { label: 'Classes', value: 'classes' },
];

export default function Dashboard() {
  const { firebaseUser, userData } = useUserContext();

  const signInWithGoogle = useUpdateAtom(signInWithGoogleAtom);
  const signOut = useUpdateAtom(signOutAtom);

  const [files, setFiles] = useState<File[] | null>(null);
  const [showHidden, setShowHidden] = useState<boolean>(false);
  const connectionContext = useConnectionContext();
  const [tab, setTab] = useState('recent');

  useEffect(() => {
    if (!firebaseUser) return;
    const db = getDatabase();
    const dbRef = ref(db, `users/${firebaseUser.uid}/files`);
    const fileQuery = query(dbRef, orderByChild('lastAccessTime'));
    const unsubscribe = onValue(fileQuery, snap => {
      if (!snap.exists) {
        setFiles([]);
      } else {
        const files: File[] = [];
        snap.forEach(file => {
          const data = file.val();
          const key = file.key;
          onValue(ref(db, 'files/' + key), snapp => {
            if (snapp.exists()) {
              set(
                child(dbRef, key + '/language'),
                snapp.val().settings.language
              );
            }
          });

          if (!showHidden && data.hidden) return;
          if (key?.startsWith('-') && isFirebaseId(key.substring(1))) {
            files.push({
              id: key,
              ...data,
            });
          }
        });
        files.reverse();
        setFiles(files);
      }
    });
    return () => off(fileQuery, 'value', unsubscribe);
  }, [firebaseUser, showHidden]);

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

      {firebaseUser.isAnonymous ? (
        <div className="text-gray-400 mt-6">
          Not signed in.{' '}
          <button
            className="underline text-gray-200 focus:outline-none hover:bg-gray-700 p-1 leading-none transition"
            onClick={() => signInWithGoogle(connectionContext)}
          >
            Sign in now
          </button>
        </div>
      ) : (
        <div className="text-gray-400 mt-6">
          Signed in as {firebaseUser.displayName}.
          <button
            className="underline text-gray-200 focus:outline-none hover:bg-gray-700 p-1 leading-none transition"
            onClick={() => signOut(connectionContext)}
          >
            Sign Out
          </button>
        </div>
      )}

      <div className="h-8"></div>

      <h2 className="text-gray-200 text-xl font-black mb-5">
        Your workspaces{' '}
        <FontAwesomeIcon
          icon={{ prefix: 'fas', iconName: 'computer' }}
          className="ml-1"
        />
      </h2>

      {files && files.length > 0 && (
        <>
          <TabBar
            tabs={tabs}
            activeTab={tab}
            onTabSelect={tab => {
              setTab(tab.value);
            }}
            homepage={true}
          />
          {tab === 'recent' && (
            <div className="border border-gray-700 divide-y divide-gray-600">
              <div className="text-gray-100 px-3.5 py-3">
                <Checkbox
                  label="Show hidden files"
                  enabled={showHidden}
                  toggleEnabled={() => setShowHidden(val => !val)}
                />
              </div>
              <FilesList files={files} showPerms={false} />
              <div className="px-3.5 py-3 flex items-center space-x-2 text-sm bg-gray-800">
                <button className="flex items-center px-2.5 py-1.5 rounded-md border border-gray-600 bg-gray-800 hover:border-gray-500 active:bg-gray-700">
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'chevron-left' }}
                    className="mr-1.5 w-3.5 h-3.5"
                  />
                  Next
                </button>
                <span className="px-2 text-gray-300">Page: 13</span>
                <button className="flex items-center px-2.5 py-1.5 rounded-md border border-gray-600 bg-gray-800 hover:border-gray-500 active:bg-gray-700">
                  Previous
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'chevron-right' }}
                    className="ml-1.5 w-3.5 h-3.5"
                  />
                </button>
              </div>
            </div>
          )}
          {tab === 'classes' && (
            <div className="divide-y divide-gray-600 border border-gray-700">
              <div className="flex items-center px-3.5 py-3 space-x-3">
                <Dropdown
                  items={['piton', 'capa']}
                  label={'Group'}
                  selected={0}
                  setSelected={() => {}}
                />
                <Dropdown
                  items={['13', '24']}
                  label={'Class'}
                  selected={0}
                  setSelected={() => {}}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="table-tasks w-full text-sm divide-y divide-gray-700 truncate">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="text-left">Problem name</th>
                      <th className="text-left">Verdict</th>
                      <th className="text-left">Last edit</th>
                      <th className="text-left">Code size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700 text-gray-300 bg-gray-900">
                    <tr>
                      <td>
                        <a
                          href="#"
                          className="underline text-white hover:text-indigo-200"
                        >
                          SPOJ KNAPSACK
                        </a>
                      </td>
                      <td className="text-white">
                        <div className="flex items-center">
                          <FontAwesomeIcon
                            icon={{ prefix: 'fas', iconName: 'xmark' }}
                            className="text-red-500 mr-2"
                          />
                          Time limit exceeded
                        </div>
                      </td>
                      <td>
                        <TimeAgoLabel date={new Date(Date.now() - 1000000)} />
                      </td>
                      <td>197 chars</td>
                    </tr>
                    <tr>
                      <td>
                        <a
                          href="#"
                          className="underline text-white hover:text-indigo-200"
                        >
                          Codeforces 1919E
                        </a>
                      </td>
                      <td className="text-white">
                        <div className="flex items-center">
                          <FontAwesomeIcon
                            icon={{ prefix: 'fas', iconName: 'check' }}
                            className="text-green-500 mr-2"
                          />
                          Correct answer
                        </div>
                      </td>
                      <td>
                        <TimeAgoLabel date={new Date(Date.now() - 1000000)} />
                      </td>
                      <td>360 chars</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="px-3.5 py-3 flex items-center space-x-2 text-sm bg-gray-800">
                <button className="flex items-center px-2.5 py-1.5 rounded-md border border-gray-600 bg-gray-800 hover:border-gray-500 active:bg-gray-700">
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'chevron-left' }}
                    className="mr-1.5 w-3.5 h-3.5"
                  />
                  Next
                </button>
                <span className="px-2 text-gray-300">Class: 13</span>
                <button className="flex items-center px-2.5 py-1.5 rounded-md border border-gray-600 bg-gray-800 hover:border-gray-500 active:bg-gray-700">
                  Previous
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'chevron-right' }}
                    className="ml-1.5 w-3.5 h-3.5"
                  />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!files && <div className="text-gray-400">Loading files...</div>}
    </div>
  );
}
