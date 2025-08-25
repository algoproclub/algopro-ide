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

const firestore = getFirestore();

type SchoolStudentDataType = {
  uid: string;
  name: string;
  isInGroup: boolean;
};

const PageContent = () => {
  const router = useRouter();
  const [group, setGroup] = useState<string | null>(null);

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
      const mySchool = groupSnapshot.get('school') ?? '(school not set)';
      setSchool(mySchool);
      const q = query(
        collection(firestore, 'userdata'),
        where('schools', 'array-contains', mySchool),
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

  return (
    <div className="px-2">
      <div>Group: {group}</div>
      <div>School: {school}</div>
      <Link href={`/groups/${group}/classes`}>Manage classes</Link>
      <div>Members:</div>
      <div className="px-2">
        {schoolStudentDatas
          .filter(data => memberEditorOpen || data.isInGroup)
          .map(data => (
            <div key={data.uid} className="flex flex-row gap-4">
              <div>{data.name}</div>
              {memberEditorOpen && (
                <button
                  onClick={async () => {
                    const userRef = doc(firestore, 'userdata', data.uid);
                    const userSnap = await getDoc(userRef);
                    const prevGroups: string[] = userSnap.get('groups') ?? [];

                    const newGroups = data.isInGroup
                      ? prevGroups.filter(g => g !== group)
                      : [...prevGroups, group];

                    setSchoolStudentDatas(prev =>
                      prev.map(item =>
                        item.uid === data.uid
                          ? { ...item, isInGroup: !data.isInGroup }
                          : item
                      )
                    );

                    await updateDoc(userRef, { groups: newGroups });
                  }}
                >
                  {data.isInGroup ? 'Remove -' : 'Add +'}
                </button>
              )}
            </div>
          ))}
        <button
          className="flex-shrink-0 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-md"
          onClick={() => {
            setMemberEditorOpen(prev => !prev);
          }}
        >
          {memberEditorOpen ? 'Stop editing members' : 'Edit members'}
        </button>
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
