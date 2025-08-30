import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import WithTeacherLogin from '../src/components/WithTeacherLogin';
import Link from 'next/link';
import { useUserContext } from '../src/context/UserContext';

const firestore = getFirestore();

const PageContent = () => {
  document.title = 'Groups';

  const { firebaseUser } = useUserContext();
  const [groups, setGroups] = useState<{ id: string; school: string }[]>([]);

  useEffect(() => {
    (async () => {
      const idTokenResult = await firebaseUser.getIdTokenResult();

      const isAdmin = (idTokenResult.claims['admin'] as boolean) ?? false;

      let groupDocs: QueryDocumentSnapshot[];
      if (isAdmin) {
        const q = collection(firestore, 'groups');
        groupDocs = (await getDocs(q)).docs;
      } else {
        const schools = (idTokenResult.claims['teacher'] as string[]) ?? [];
        if (schools.length > 0) {
          const q = query(
            collection(firestore, 'groups'),
            where('school', 'in', schools)
          );

          groupDocs = (await getDocs(q)).docs;
        } else {
          groupDocs = [];
        }
      }
      setGroups(
        groupDocs.map(d => ({
          id: d.id,
          school: d.get('school'),
        }))
      );
    })();
  }, [firebaseUser]);

  return (
    <div className="px-2">
      {groups.map(group => (
        <Link
          key={group.id}
          href={`/groups/${group.id}`}
          className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1E1E1E] focus:ring-indigo-500"
        >
          Edit {group.id} (school: {group.school})
        </Link>
      ))}
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
