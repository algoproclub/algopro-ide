import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import WithTeacherLogin from '../src/components/WithTeacherLogin';
import { useUserContext } from '../src/context/UserContext';
import { GroupInfo, School } from './teacher';
import Dropdown from '../src/components/Dropdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  EditInlineTwoFieldsModal,
  TwoFieldValue,
} from '../src/components/EditTextModal';
import Link from 'next/link';

const firestore = getFirestore();

const PageContent = () => {
  document.title = 'Edit groups';

  const { userRole } = useUserContext();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [schoolInd, setSchoolInd] = useState(0);
  const schoolNames = schools.map(s => s.name);

  useEffect(() => {
    const fetchTeacherSchools = async () => {
      let schools: School[] = [];
      if (userRole?.admin) {
        const results = await getDocs(collection(firestore, 'schools'));
        results.forEach(docu => {
          const data = docu.data();
          schools.push({
            id: docu.id,
            name: data?.name || docu.id,
          });
        });
      } else {
        const schoolIDs = userRole?.teacher;
        if (!schoolIDs) {
          return [];
        }
        schools = await Promise.all(
          schoolIDs.map(async (id: string) => {
            const docu = await getDoc(doc(firestore, 'schools', id));
            return { id, name: docu.data()?.name || docu.id };
          })
        );
      }
      console.log('schools', schools);
      setSchools(schools);
    };
    fetchTeacherSchools();
  }, [userRole]);

  const fetchGroups = async () => {
    if (!schools[schoolInd]) {
      return;
    }
    const groupDocs = (
      await getDocs(
        query(
          collection(firestore, 'groups'),
          where('school', '==', schools[schoolInd].id)
        )
      )
    ).docs;
    setGroups(
      groupDocs.map(docu => {
        return {
          id: docu.id,
          name: docu.get('name') || docu.id,
          schoolID: docu.get('school'),
        };
      })
    );
  };

  useEffect(() => {
    fetchGroups();
  }, [schoolInd, schools]);

  const onSave = async (group: TwoFieldValue) => {
    let success = true;
    try {
      const groupDoc = await getDoc(doc(firestore, 'groups', group.left));
      if (groupDoc.exists()) {
        success = false;
      }
    } catch (e) {
      success = false;
      console.error(e);
    }
    if (!success) {
      alert(
        'A group with such an ID already exists. Please choose a different ID.'
      );
      return;
    }
    await setDoc(doc(firestore, 'groups', group.left), {
      name: group.right,
      school: schools[schoolInd].id,
    });
    await fetchGroups();
    setIsOpen(false);
  };
  const deleteGroup = (id: string) => {
    const doDelete = async () => {
      await deleteDoc(doc(firestore, 'groups', id));
      await fetchGroups();
      setIsOpen(false);
    };
    if (
      confirm(
        `Group ${id} will be irreversbily deleted. Do you want to proceed?`
      )
    ) {
      doDelete();
    }
  };

  return (
    <div className="px-2">
      <EditInlineTwoFieldsModal
        isOpen={isOpen}
        title="Add new group"
        value={{ left: '', right: '' }}
        onSave={onSave}
        onClose={() => setIsOpen(false)}
        leftLabel="Group ID"
        rightLabel="Group name"
      />
      <div className="mx-auto max-w-7xl border border-gray-600 bg-gray-800 mt-4">
        <div className="p-4 border-b border-gray-600 flex items-center">
          <Dropdown
            items={schoolNames}
            label="School"
            selected={schoolInd}
            setSelected={setSchoolInd}
          />
          <button
            className="flex-shrink-0 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-md mt-4 ml-3 flex items-center"
            onClick={() => setIsOpen(true)}
          >
            New group
            <FontAwesomeIcon
              icon={{ prefix: 'fas', iconName: 'plus' }}
              className="ml-2 w-4 h-4"
            />
          </button>
        </div>
        <div className="bg-gray-900 divide-y divide-gray-700 min-h-4">
          {groups.map(group => (
            <div
              className="flex items-center justify-between divide-x divide-gray-700"
              key={group.id}
            >
              <div className="px-4 py-2 truncate flex items-center">
                <FontAwesomeIcon
                  icon={{ prefix: 'fas', iconName: 'user-group' }}
                  className="mr-2 w-4 h-4"
                />
                {group.name} ({group.id})
              </div>
              <div className="px-3 py-2">
                <Link href={`groups/${group.id}`}>
                  <button
                    title="Jump to group edit page"
                    className="px-2 py-1 rounded-md hover:bg-gray-700"
                  >
                    <FontAwesomeIcon
                      icon={{ prefix: 'fas', iconName: 'arrow-right' }}
                      className="w-3.5 h-3.5"
                    />
                  </button>
                </Link>
                <button
                  title="Delete group"
                  className="px-2 py-1 rounded-md hover:bg-gray-700"
                  onClick={() => {
                    deleteGroup(group.id);
                  }}
                >
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'trash' }}
                    className="w-3.5 h-3.5"
                  />
                </button>
              </div>
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
