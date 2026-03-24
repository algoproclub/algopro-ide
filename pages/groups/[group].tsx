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
  const [showAllStudents, setShowAllStudents] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!memberEditorOpen) {
      setSearchQuery('');
      setSelectedStudentId(null);
      setShowAllStudents(false);
    }
  }, [memberEditorOpen]);

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

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredSuggestions = normalizedQuery
    ? schoolStudentDatas.filter(data =>
        data.name.toLowerCase().includes(normalizedQuery)
      )
    : [];
  const selectedStudent = selectedStudentId
    ? schoolStudentDatas.find(data => data.uid === selectedStudentId)
    : undefined;
  const listStudents = (() => {
    const base = schoolStudentDatas.filter(
      data => showAllStudents || data.isInGroup
    );
    if (selectedStudent && !base.some(data => data.uid === selectedStudent.uid)) {
      return [selectedStudent, ...base];
    }
    return base;
  })();

  return (
    <div className="px-2">
      <div className="mx-auto max-w-7xl border border-gray-600 bg-gray-800 mt-4">
        <div className="p-4 pl-5 border-b border-gray-600 flex justify-between items-center truncate">
          <span className="flex items-center truncate">
            <FontAwesomeIcon
              className="flex-shrink-0 w-5 h-5 mr-1.5 inline"
              icon={{ iconName: 'user-group', prefix: 'fas' }}
            />
            <span className="truncate">
              <span className="font-semibold">{groupName}</span>
              <span className="ml-1 truncate">({school})</span>
            </span>
          </span>
          <div className="space-x-2 flex items-center">
            <button
              className={`flex-shrink-0 px-4 py-2.5 ${memberEditorOpen ? 'bg-red-700 hover:bg-red-800 active:bg-red-900' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'} rounded-md`}
              onClick={() => {
                setMemberEditorOpen(prev => !prev);
              }}
            >
              {memberEditorOpen ? 'Stop editing members' : 'Edit members'}
            </button>
            <Link href={`/groups/${group}/classes`}>
              <button className="px-4 py-2.5 bg-gray-600 hover:bg-gray-500 active:bg-gray-400 rounded-md flex items-center">
                Classes
                <FontAwesomeIcon
                  className="ml-2 w-4 h-4 inline"
                  icon={{ prefix: 'fas', iconName: 'right-to-bracket' }}
                />
              </button>
            </Link>
          </div>
        </div>
        {memberEditorOpen && (
          <div className="p-4 border-b border-gray-600 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-300">Add student:</div>
            <div className="flex flex-1 items-center gap-2">
              <div className="relative w-full">
                <input
                  className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Search by name…"
                  type="text"
                  value={searchQuery}
                  onChange={event => {
                    setSearchQuery(event.target.value);
                  }}
                />
                {normalizedQuery.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-600 bg-gray-800 shadow-lg">
                    {filteredSuggestions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">
                        No matches.
                      </div>
                    ) : (
                    filteredSuggestions.map(data => (
                      <div
                        key={data.uid}
                        className="w-full px-3 py-2 hover:bg-gray-700 flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          className="text-left flex-1"
                          onClick={() => {
                            setSelectedStudentId(data.uid);
                            setSearchQuery('');
                          }}
                        >
                          {data.name}
                        </button>
                        <button
                          type="button"
                          className={`${data.isInGroup ? 'bg-red-700 hover:bg-red-800 active:bg-red-900' : 'bg-green-700 hover:bg-green-800 active:bg-green-900'} rounded-md px-2 py-1 text-xs`}
                          onClick={() => toggleInGroup(data)}
                        >
                          {data.isInGroup ? 'Remove' : 'Add'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
                )}
              </div>
              <button
                className="px-4 py-2.5 bg-gray-600 hover:bg-gray-500 active:bg-gray-400 rounded-md whitespace-nowrap"
                onClick={() => setShowAllStudents(prev => !prev)}
              >
                {showAllStudents ? 'List all members' : 'List all students'}
              </button>
            </div>
          </div>
        )}
        <div className="w-full divide-y divide-gray-700 bg-gray-900 min-h-4">
          {listStudents.map(data => (
            <div key={data.uid} className="flex items-center justify-between">
              <div className="p-4">{data.name}</div>
              {(memberEditorOpen || selectedStudentId === data.uid) && (
                <div className="px-4 py-2.5">
                  <button
                    onClick={() => toggleInGroup(data)}
                    className={`${data.isInGroup ? 'bg-red-700 hover:bg-red-800 active:bg-red-900' : 'bg-green-700 hover:bg-green-800 active:bg-green-900'} rounded-md px-3 py-1.5 flex items-center`}
                  >
                    {data.isInGroup ? 'Remove' : 'Add'}
                    {data.isInGroup ? (
                      <FontAwesomeIcon
                        icon={{ prefix: 'fas', iconName: 'minus' }}
                        className="w-4 h-4 ml-2 inline"
                      />
                    ) : (
                      <FontAwesomeIcon
                        icon={{ prefix: 'fas', iconName: 'plus' }}
                        className="w-4 h-4 ml-2 inline"
                      />
                    )}
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
