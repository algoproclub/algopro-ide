import React, { useState } from 'react';
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
import Dropdown from '../src/components/Dropdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { EditGroupModal, TwoFieldValue } from '../src/components/EditTextModal';
import Link from 'next/link';
import PageTitle from '../src/components/PageTitle';
import {
  useManagedSchools,
  useSchoolGroups,
} from '../src/hooks/useClassroomMetadata';
import { useScopedSelection } from '../src/hooks/useScopedSelection';

const firestore = getFirestore();

const PageContent = () => {
  const { userRole } = useUserContext();
  const [isOpen, setIsOpen] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const schoolsResource = useManagedSchools(userRole);
  const schools = schoolsResource.data;
  const [schoolID, setSchoolID] = useScopedSelection(
    'group-editor-schools',
    schools.map(school => school.id)
  );
  const groupsResource = useSchoolGroups(schoolID, {
    includeInactive: true,
    refreshVersion,
  });
  const groups = groupsResource.data;

  const onSave = async (group: TwoFieldValue) => {
    if (!schoolID) return;
    const groupID = `${schoolID}~${group.left}`;
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
        school: schoolID,
      });
    } catch (e) {
      alert(
        'The group could not be created. Please make sure that the group ID and the group name are non-empty, and the ID consists only of letters, digits, underscores (_), or hyphens (-).'
      );
      console.error(e);
      return;
    }
    setRefreshVersion(version => version + 1);
    setIsOpen(false);
  };
  const deleteGroup = (id: string) => {
    const doDelete = async () => {
      if (!schoolID) return;
      const q = query(
        collection(firestore, 'userdata'),
        where('schools', 'array-contains', schoolID)
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
      setRefreshVersion(version => version + 1);
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
      {schoolID && (
        <EditGroupModal
          isOpen={isOpen}
          schoolID={schoolID}
          value={{ left: '', right: '' }}
          onSave={onSave}
          onClose={() => setIsOpen(false)}
        />
      )}
      <div className="mx-auto max-w-7xl border theme-border theme-surface-raised mt-4">
        <div className="p-4 border-b theme-border flex items-center">
          <Dropdown
            items={schools.map(school => ({
              value: school.id,
              label: school.name,
            }))}
            label="School"
            selected={schoolID}
            setSelected={setSchoolID}
            disabled={schoolsResource.status === 'loading'}
            disabledPlaceholder="Loading schools…"
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
                <Link
                  href={`groups/${group.id}`}
                  aria-label={`Edit ${group.name}`}
                  title="Jump to group edit page"
                  className="px-2 py-1 rounded-md hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)]"
                >
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'arrow-right' }}
                    className="w-3.5 h-3.5 inline"
                  />
                </Link>
                <button
                  aria-label={`Delete ${group.name}`}
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
