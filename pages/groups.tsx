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
  writeBatch,
  arrayRemove,
} from 'firebase/firestore';
import WithTeacherLogin from '../src/components/WithTeacherLogin';
import { useUserContext } from '../src/context/UserContext';
import { fetchTeacherSchools, GroupInfo, School } from './teacher';
import Dropdown from '../src/components/Dropdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { EditGroupModal, TwoFieldValue } from '../src/components/EditTextModal';
import Link from 'next/link';
import PageTitle from '../src/components/PageTitle';

const firestore = getFirestore();

const PageContent = () => {
  const { userRole } = useUserContext();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [schoolInd, setSchoolInd] = useState(0);
  const schoolNames = schools.map(s => s.name);

  useEffect(() => {
    const initSchools = async () => {
      const schools = await fetchTeacherSchools(userRole);
      setSchools(schools);
    };
    initSchools();
  }, [userRole]);

  const fetchGroups = async () => {
    if (!schools[schoolInd]) {
      return;
    }
    const groupsSnap = await getDocs(
      query(
        collection(firestore, 'groups'),
        where('school', '==', schools[schoolInd].id)
      )
    );
    setGroups(
      groupsSnap.docs.map(docu => {
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
    const groupID = `${schools[schoolInd].id}~${group.left}`;
    const groupName = group.right;
    let success = true;
    try {
      const groupSnap = await getDoc(doc(firestore, 'groups', groupID));
      if (groupSnap.exists()) {
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
    try {
      await setDoc(doc(firestore, 'groups', groupID), {
        name: groupName,
        school: schools[schoolInd].id,
      });
    } catch (e) {
      alert(
        'The group could not be created. Please make sure that the group ID and the group name are non-empty, and the ID consists only of letters, digits, underscores (_), or hyphens (-).'
      );
      console.error(e);
      return;
    }
    await fetchGroups();
    setIsOpen(false);
  };
  const deleteGroup = (id: string) => {
    const doDelete = async () => {
      const q = query(
        collection(firestore, 'userdata'),
        where('schools', 'array-contains', schools[schoolInd].id)
      );
      const snap = await getDocs(q);
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'groups', id));

      const classesRef = collection(firestore, 'groups', id, 'classes');
      const classesSnap = await getDocs(classesRef);

      classesSnap.forEach(docu => {
        batch.delete(docu.ref);
      });
      snap.forEach(d => {
        if ((d.get('groups') ?? []).includes(id)) {
          batch.update(doc(firestore, 'userdata', d.id), {
            groups: arrayRemove(id),
          });
        }
      });
      await batch.commit();
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
      {schools[schoolInd] && (
        <EditGroupModal
          isOpen={isOpen}
          schoolID={schools[schoolInd].id}
          value={{ left: '', right: '' }}
          onSave={onSave}
          onClose={() => setIsOpen(false)}
        />
      )}
      <div className="mx-auto max-w-7xl border theme-border theme-surface-raised mt-4">
        <div className="p-4 border-b theme-border flex items-center">
          <Dropdown
            items={schoolNames}
            label="School"
            selected={schoolInd}
            setSelected={setSchoolInd}
          />
          <button
            className="flex-shrink-0 px-4 py-2.5 theme-button-primary rounded-md mt-4 ml-3 flex items-center"
            onClick={() => setIsOpen(true)}
          >
            New group
            <FontAwesomeIcon
              icon={{ prefix: 'fas', iconName: 'plus' }}
              className="ml-2 w-4 h-4"
            />
          </button>
        </div>
        <div className="theme-surface divide-y divide-[color:var(--border-muted)] min-h-4">
          {groups.map(group => (
            <div
              className="flex items-center justify-between divide-x divide-[color:var(--border-muted)]"
              key={group.id}
            >
              <div className="px-4 py-2 flex items-center truncate">
                <FontAwesomeIcon
                  icon={{ prefix: 'fas', iconName: 'user-group' }}
                  className="mr-2 w-4 h-4 flex-shrink-0"
                />
                <span className="truncate">
                  <span className="font-semibold">{group.name} </span>
                  <span className="theme-text-muted">({group.id})</span>
                </span>
              </div>
              <div className="px-3 py-2 flex-shrink-0">
                <Link href={`groups/${group.id}`}>
                  <button
                    title="Jump to group edit page"
                    className="px-2 py-1 rounded-md hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)]"
                  >
                    <FontAwesomeIcon
                      icon={{ prefix: 'fas', iconName: 'arrow-right' }}
                      className="w-3.5 h-3.5 inline"
                    />
                  </button>
                </Link>
                <button
                  title="Delete group"
                  className="px-2 py-1 rounded-md hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)]"
                  onClick={() => {
                    deleteGroup(group.id);
                  }}
                >
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'trash' }}
                    className="w-3.5 h-3.5 inline"
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
    <>
      <PageTitle>Edit groups</PageTitle>
      <WithTeacherLogin>
        <PageContent />
      </WithTeacherLogin>
    </>
  );
}
