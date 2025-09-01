import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  where,
  getDoc,
  updateDoc,
  orderBy,
} from 'firebase/firestore';
import WithTeacherLogin from '../../src/components/WithTeacherLogin';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const firestore = getFirestore();

type SchoolStudentDataType = {
  uid: string;
  name: string;
  isInGroup: boolean;
};

const PageContent = () => {
  const router = useRouter();
  const [group, setGroup] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);

  document.title = `Manage group [${group}]`;

  useEffect(() => {
    if (typeof router.query.group === 'string') {
      setGroup(router.query.group);
    }
  }, [router]);

  const [school, setSchool] = useState<string>('');
  const [schoolStudentDatas, setSchoolStudentDatas] = useState<
    SchoolStudentDataType[]
  >([]);
  const [memberEditorOpen, setMemberEditorOpen] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      if (group === null) return;

      const groupSnapshot = await getDoc(doc(firestore, 'groups', group));
      const mySchoolID = groupSnapshot.get('school');
      const mySchool = mySchoolID
        ? ((await getDoc(doc(firestore, 'schools', mySchoolID))).data()?.name ??
          '(school not set)')
        : '(school not set)';

      setSchool(mySchool);
      setGroupName(
        (await getDoc(doc(firestore, 'groups', group))).data()?.name ?? group
      );
      const q = query(
        collection(firestore, 'userdata'),
        where('schools', 'array-contains', mySchoolID),
        orderBy('user_full_name')
      );
      const schoolStudentsSnapshot = await getDocs(q);
      setSchoolStudentDatas(
        schoolStudentsSnapshot.docs.map(doc => ({
          uid: doc.id,
          name: doc.get('user_full_name') ?? '(name not set)',
          isInGroup: ((doc.get('groups') ?? []) as string[]).includes(group),
        }))
      );
    })();
  }, [group]);

  const toggleInGroup = async (data: SchoolStudentDataType) => {
    const userRef = doc(firestore, 'userdata', data.uid);
    const userSnap = await getDoc(userRef);
    const prevGroups: string[] = userSnap.get('groups') ?? [];

    const newGroups = data.isInGroup
      ? prevGroups.filter(g => g !== group)
      : [...prevGroups, group];

    setSchoolStudentDatas(prev =>
      prev.map(item =>
        item.uid === data.uid ? { ...item, isInGroup: !data.isInGroup } : item
      )
    );
    await updateDoc(userRef, { groups: newGroups });
  };

  return (
    <div className="px-2">
      <div className="mx-auto max-w-7xl border border-gray-600 bg-gray-800 mt-4">
        <div className="p-4 pl-5 border-b border-gray-600 flex justify-between items-center">
          <div className="flex items-center min-w-0 flex-1">
            <FontAwesomeIcon
              className="flex-shrink-0 w-4 h-4 mr-2 text-gray-400"
              icon={{ iconName: 'user-group', prefix: 'fas' }}
            />
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-white">{groupName}</span>
              <span className="ml-2 text-gray-400 truncate">({school})</span>
            </div>
          </div>
          <div className="flex items-center space-x-3 flex-shrink-0">
            <button
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                memberEditorOpen
                  ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white'
              }`}
              onClick={() => {
                setMemberEditorOpen(prev => !prev);
              }}
            >
              {memberEditorOpen ? 'Stop editing members' : 'Edit members'}
            </button>
            <Link href={`/groups/${group}/classes`}>
              <button className="flex items-center px-4 py-2 text-sm font-medium bg-gray-600 hover:bg-gray-500 active:bg-gray-400 text-white rounded-md transition-colors">
                Classes
                <FontAwesomeIcon
                  className="ml-2 w-3 h-3"
                  icon={{ prefix: 'fas', iconName: 'right-to-bracket' }}
                />
              </button>
            </Link>
          </div>
        </div>
        <div className="w-full divide-y divide-gray-700 bg-gray-900">
          {schoolStudentDatas
            .filter(data => memberEditorOpen || data.isInGroup)
            .map(data => (
              <div
                key={data.uid}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center min-w-0 flex-1">
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center mr-3">
                    <FontAwesomeIcon
                      icon={{ prefix: 'fas', iconName: 'user' }}
                      className="w-3 h-3 text-gray-300"
                    />
                  </div>
                  <span className="text-white font-medium truncate">
                    {data.name}
                  </span>
                  {data.isInGroup && !memberEditorOpen && (
                    <span className="ml-2 px-2 py-1 text-xs bg-green-800 text-green-200 rounded-full">
                      Member
                    </span>
                  )}
                </div>
                {memberEditorOpen && (
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => toggleInGroup(data)}
                      className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        data.isInGroup
                          ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white'
                          : 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white'
                      }`}
                    >
                      {data.isInGroup ? 'Remove' : 'Add'}
                      <FontAwesomeIcon
                        icon={{
                          prefix: 'fas',
                          iconName: data.isInGroup ? 'minus' : 'plus',
                        }}
                        className="w-3 h-3 ml-2"
                      />
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default function ClassGroupSelectPage() {
  return (
    <WithTeacherLogin>
      <PageContent />
    </WithTeacherLogin>
  );
}
