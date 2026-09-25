import React, { useCallback, useEffect, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import WithTeacherLogin from '../src/components/WithTeacherLogin';
import { useUserContext } from '../src/context/UserContext';
import {
  createGroupClass,
  createGroup,
  deleteGroup as deleteGroupData,
  deleteGroupClass,
  type GroupClass,
  type GroupClassData,
  updateGroupClass,
} from '../src/data/classroomMetadata';
import {
  EditGroupModal,
  EditInlineTextModal,
  TwoFieldValue,
} from '../src/components/EditTextModal';
import ConfirmationModal from '../src/components/ConfirmationModal';
import { useRouter } from 'next/router';
import GroupMemberEditor from '../src/components/groups/GroupMemberEditor';
import GroupClassEditor, {
  GroupClassUpdate,
} from '../src/components/groups/GroupClassEditor';
import GroupsSidebar, {
  ClassSidebarSection,
  GroupSidebarSection,
  SchoolSidebarSection,
  SidebarViewTabs,
} from '../src/components/groups/GroupsSidebar';
import GroupList from '../src/components/groups/GroupList';
import PageTitle from '../src/components/PageTitle';
import {
  useGroupClasses as useGroupClassesResource,
  useManagedSchools,
  useSchoolGroups,
} from '../src/hooks/useClassroomMetadata';
import { useScopedSelection } from '../src/hooks/useScopedSelection';

type PendingClassAction = { type: 'select'; classID: string } | { type: 'new' };

type ClassDialog =
  | { type: 'newClass' }
  | { type: 'deleteClass'; classID: string }
  | { type: 'discardClassChanges'; action: PendingClassAction }
  | null;

const emptyClasses: GroupClassMap = {};
const warningMessage = 'You have unsaved changes. Do you want to leave?';

type GroupClassMap = Record<string, GroupClassData>;
type GroupClassesState = {
  groupID: string;
  snapshot: GroupClass[];
  classes: GroupClassMap;
  savedClasses: GroupClassMap;
};

const withoutClass = (classes: GroupClassMap, classID: string) =>
  Object.fromEntries(Object.entries(classes).filter(([id]) => id !== classID));

const classDataMatches = (
  currentClass: GroupClassData | undefined,
  savedClass: GroupClassData | undefined
) => JSON.stringify(currentClass) === JSON.stringify(savedClass);

function useEditableGroupClasses(groupID: string | null) {
  const [state, setState] = useState<GroupClassesState>();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [mutatingClassID, setMutatingClassID] = useState<string | null>(null);
  const mutationID = useRef(0);
  const refreshInFlight = useRef(false);
  const loadedClasses = useGroupClassesResource(groupID, refreshVersion);
  useEffect(() => {
    if (!loadedClasses.isRefreshing) refreshInFlight.current = false;
  }, [loadedClasses.data, loadedClasses.isRefreshing, loadedClasses.status]);
  const loadedMap = Object.fromEntries(
    loadedClasses.data.map(groupClass => [groupClass.id, groupClass.data])
  );
  const loadedState: GroupClassesState = {
    groupID: groupID ?? '',
    snapshot: loadedClasses.data,
    classes: loadedMap,
    savedClasses: loadedMap,
  };
  const activeState =
    state?.groupID === groupID && state.snapshot === loadedClasses.data
      ? state
      : loadedState;
  const isReady = groupID !== null && loadedClasses.hasLoadedData;
  const classes = isReady ? activeState.classes : emptyClasses;
  const unsavedClassIDs = new Set(
    Object.keys(classes).filter(
      id => !classDataMatches(classes[id], activeState.savedClasses[id])
    )
  );
  const sortedClasses = Object.entries(classes)
    .map(([id, data]) => ({ id, data }))
    .sort((left, right) => right.data.creationTime - left.data.creationTime);

  const updateCurrent = (
    apply: (current: GroupClassesState) => GroupClassesState
  ) =>
    setState(current => {
      const currentState =
        current?.groupID === groupID && current.snapshot === loadedClasses.data
          ? current
          : loadedState;
      return groupID && loadedClasses.hasLoadedData
        ? apply(currentState)
        : current;
    });

  const updateClass = (classID: string, update: GroupClassUpdate) => {
    if (
      loadedClasses.isRefreshing ||
      refreshInFlight.current ||
      mutationID.current
    )
      return;
    updateCurrent(current => {
      const currentClass = current.classes[classID];
      if (!currentClass && typeof update === 'function') return current;
      return {
        ...current,
        classes: {
          ...current.classes,
          [classID]:
            typeof update === 'function' ? update(currentClass) : update,
        },
      };
    });
  };

  const createClass = (id: string) => {
    const normalizedID = id.trim();
    if (!isReady) return { error: 'Classes are still loading.' };
    if (
      loadedClasses.isRefreshing ||
      refreshInFlight.current ||
      mutationID.current
    )
      return { error: 'Wait for the current class operation to finish.' };
    if (!normalizedID) return { error: 'Please enter a class ID.' };
    if (normalizedID.includes('/'))
      return { error: 'Class IDs cannot contain slashes.' };
    if (classes[normalizedID]) {
      return { error: 'The entered ID already exists.' };
    }
    updateClass(normalizedID, { tasks: [], creationTime: Date.now() });
    return { id: normalizedID };
  };

  const runMutation = async <T,>(
    classID: string,
    operation: () => Promise<T>
  ) => {
    if (mutationID.current || refreshInFlight.current)
      throw new Error('A class operation is in progress.');
    const currentMutationID = ++mutationID.current;
    setMutatingClassID(classID);
    try {
      return await operation();
    } finally {
      if (mutationID.current === currentMutationID) {
        mutationID.current = 0;
        setMutatingClassID(null);
      }
    }
  };

  const saveClass = async (id: string) => {
    const data = classes[id];
    if (!groupID || !data) return false;
    return runMutation(id, async () => {
      if (activeState.savedClasses[id])
        await updateGroupClass(groupID, id, data);
      else if (!(await createGroupClass(groupID, id, data))) return false;
      updateCurrent(current => ({
        ...current,
        savedClasses: { ...current.savedClasses, [id]: data },
      }));
      return true;
    });
  };

  const deleteClass = async (id: string) => {
    if (!groupID) return;
    await runMutation(id, async () => {
      if (activeState.savedClasses[id]) await deleteGroupClass(groupID, id);
      updateCurrent(current => ({
        ...current,
        classes: withoutClass(current.classes, id),
        savedClasses: withoutClass(current.savedClasses, id),
      }));
    });
  };

  const discardClassChanges = (id: string) =>
    updateCurrent(current => {
      const savedClass = current.savedClasses[id];
      return {
        ...current,
        classes: savedClass
          ? { ...current.classes, [id]: savedClass }
          : withoutClass(current.classes, id),
      };
    });

  const discardAllClassChanges = () => {
    if (!mutationID.current)
      updateCurrent(current => ({
        ...current,
        classes: current.savedClasses,
      }));
  };

  return {
    classes,
    sortedClasses,
    hasUnsavedChanges: unsavedClassIDs.size > 0,
    dirtyClassID: unsavedClassIDs.values().next().value ?? null,
    isClassDirty: (id: string) => unsavedClassIDs.has(id),
    isReady,
    status: loadedClasses.status,
    isRefreshing: loadedClasses.isRefreshing,
    mutatingClassID,
    updateClass,
    createClass,
    saveClass,
    deleteClass,
    discardClassChanges,
    discardAllClassChanges,
    refresh: () => {
      if (!mutationID.current && !refreshInFlight.current) {
        refreshInFlight.current = true;
        setRefreshVersion(version => version + 1);
      }
    },
  };
}

type Navigation = () => void | Promise<unknown>;

const runNavigation = (navigation: Navigation, onSettled?: () => void) => {
  try {
    void Promise.resolve(navigation())
      .catch(error => console.error('Navigation failed', error))
      .finally(onSettled);
  } catch (error) {
    console.error('Navigation failed', error);
    onSettled?.();
  }
};

function useUnsavedChangesWarning(
  hasUnsavedChanges: boolean,
  discardChanges: () => void
) {
  const router = useRouter();
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const discardChangesRef = useRef(discardChanges);
  const pendingNavigationRef = useRef<Navigation | null>(null);
  const allowNavigationRef = useRef(false);
  const [isNavigationConfirmationOpen, setIsNavigationConfirmationOpen] =
    useState(false);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
    discardChangesRef.current = discardChanges;
  }, [discardChanges, hasUnsavedChanges]);

  useEffect(() => {
    const getCurrentPosition = () => {
      const entry = window.navigation.currentEntry;
      if (!entry) throw new Error('No active history entry.');
      return entry.index;
    };
    const currentPosition = getCurrentPosition();
    let restoringHistory = false;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChangesRef.current || allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    router.beforePopState(() => {
      if (restoringHistory) {
        restoringHistory = false;
        return false;
      }
      if (!hasUnsavedChangesRef.current || allowNavigationRef.current)
        return true;
      const shouldLeave = window.confirm(warningMessage);
      if (shouldLeave) discardChangesRef.current();
      else {
        // popstate runs after the browser moves. Undo the traversal without
        // replacing entries, losing forward history, or prompting a second time.
        restoringHistory = true;
        window.history.go(currentPosition - getCurrentPosition());
      }
      return shouldLeave;
    });

    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
      router.beforePopState(() => true);
    };
  }, [router, router.asPath]);

  const requestNavigation = useCallback((navigation: Navigation) => {
    if (!hasUnsavedChangesRef.current || allowNavigationRef.current) {
      runNavigation(navigation);
      return;
    }

    pendingNavigationRef.current = navigation;
    setIsNavigationConfirmationOpen(true);
  }, []);

  const cancelNavigation = () => {
    pendingNavigationRef.current = null;
    setIsNavigationConfirmationOpen(false);
  };

  const confirmNavigation = () => {
    const navigation = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    setIsNavigationConfirmationOpen(false);
    if (!navigation) return;

    discardChangesRef.current();
    allowNavigationRef.current = true;
    runNavigation(navigation, () => {
      allowNavigationRef.current = false;
    });
  };

  useEffect(() => {
    const guardLinkNavigation = (event: MouseEvent) => {
      if (!hasUnsavedChangesRef.current || allowNavigationRef.current) return;
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>('a[href]');
      if (
        !link ||
        (link.target && link.target !== '_self') ||
        link.hasAttribute('download')
      )
        return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const destination = `${url.pathname}${url.search}${url.hash}`;
      if (destination === router.asPath) return;

      event.preventDefault();
      requestNavigation(() => router.push(destination));
    };

    document.addEventListener('click', guardLinkNavigation, true);
    return () =>
      document.removeEventListener('click', guardLinkNavigation, true);
  }, [requestNavigation, router]);

  return {
    isNavigationConfirmationOpen,
    requestNavigation,
    confirmNavigation,
    cancelNavigation,
  };
}

const PageContent = () => {
  const { userRole } = useUserContext();
  const router = useRouter();
  const selectedGroupID =
    typeof router.query.group === 'string' ? router.query.group : null;
  const selectedView = router.query.view === 'classes' ? 'classes' : 'members';

  const [groupsRefreshNonce, setGroupsRefreshNonce] = useState(0);
  const [schoolsRefreshNonce, setSchoolsRefreshNonce] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [groupPendingDeletion, setGroupPendingDeletion] = useState<
    string | null
  >(null);
  const [classDialog, setClassDialog] = useState<ClassDialog>(null);
  const [newClassID, setNewClassID] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [hasUnsavedMemberChanges, setHasUnsavedMemberChanges] = useState(false);
  const schoolsResource = useManagedSchools(userRole, schoolsRefreshNonce);
  const schools = schoolsResource.data;
  const [listedSchoolID, setSchoolID] = useScopedSelection(
    'group-editor-schools',
    schools.map(school => school.id)
  );
  const routeSchoolID = selectedGroupID?.split('~', 1)[0] ?? null;
  const selectedSchoolID = schools.some(school => school.id === routeSchoolID)
    ? routeSchoolID
    : listedSchoolID;
  const selectedSchool = schools.find(school => school.id === selectedSchoolID);
  const groupsResource = useSchoolGroups(selectedSchoolID || null, {
    refreshVersion: groupsRefreshNonce,
  });
  const groups = groupsResource.data;
  const filteredGroups = groupSearchQuery.trim()
    ? new Fuse(groups, {
        keys: ['name', 'id'],
        threshold: 0.35,
        ignoreLocation: true,
      })
        .search(groupSearchQuery, { limit: 50 })
        .map(result => result.item)
    : groups;
  const selectedGroup = selectedGroupID
    ? groups.find(group => group.id === selectedGroupID)
    : undefined;
  const resolvedGroupID = selectedGroup?.id ?? null;
  const selectedGroupSchool = selectedGroup
    ? schools.find(school => school.id === selectedGroup.schoolID)
    : undefined;
  const groupClasses = useEditableGroupClasses(resolvedGroupID);
  const navigationGuard = useUnsavedChangesWarning(
    groupClasses.hasUnsavedChanges || hasUnsavedMemberChanges,
    groupClasses.discardAllClassChanges
  );
  const [activeClassID, setActiveClassID] = useScopedSelection(
    resolvedGroupID,
    groupClasses.sortedClasses.map(groupClass => groupClass.id),
    groupClasses.sortedClasses[0]?.id ?? null
  );

  const refreshGroups = () => setGroupsRefreshNonce(value => value + 1);
  const refreshSchools = () => setSchoolsRefreshNonce(value => value + 1);
  const visibleListStatus = selectedSchoolID
    ? groupsResource.status
    : schoolsResource.status;

  const selectGroup = (groupID: string, view = selectedView) => {
    if (groupClasses.mutatingClassID) return;
    navigationGuard.requestNavigation(() =>
      router.push(
        view === 'classes' ? `/groups/${groupID}/classes` : `/groups/${groupID}`
      )
    );
  };

  const onSave = async (group: TwoFieldValue) => {
    if (!selectedSchool) return;
    const shortID = group.left.trim();
    const name = group.right.trim();
    if (!/^[a-z0-9_-]+$/.test(shortID) || !name) {
      alert(
        'Enter a non-empty group name and a lowercase ID containing only letters, digits, underscores (_), or hyphens (-).'
      );
      return;
    }
    const groupID = `${selectedSchool.id}~${shortID}`;
    try {
      const created = await createGroup({
        id: groupID,
        name,
        schoolID: selectedSchool.id,
      });
      if (!created) {
        alert(
          'A group with such an ID already exists. Please choose a different ID.'
        );
        return;
      }
    } catch (error) {
      alert(
        'The group could not be created. Please make sure that the group ID and the group name are non-empty, and the ID consists only of letters, digits, underscores (_), or hyphens (-).'
      );
      console.error(error);
      return;
    }
    refreshGroups();
    setIsOpen(false);
  };

  const performClassAction = (action: PendingClassAction) => {
    if (!resolvedGroupID) return;
    if (action.type === 'select') {
      setActiveClassID(action.classID);
    } else {
      setNewClassID('');
      setClassDialog({ type: 'newClass' });
    }
  };
  const requestClassAction = (action: PendingClassAction) => {
    if (groupClasses.mutatingClassID || groupClasses.isRefreshing) return;
    if (action.type === 'select' && action.classID === activeClassID) return;
    if (groupClasses.dirtyClassID)
      setClassDialog({ type: 'discardClassChanges', action });
    else performClassAction(action);
  };

  return (
    <div className="bg-canvas px-3 text-content">
      {selectedSchool && (
        <EditGroupModal
          isOpen={isOpen}
          schoolID={selectedSchool.id}
          value={{ left: '', right: '' }}
          onSave={onSave}
          onClose={() => setIsOpen(false)}
        />
      )}
      <ConfirmationModal
        isOpen={navigationGuard.isNavigationConfirmationOpen}
        title="Leave with unsaved changes?"
        description="Your unsaved changes will be discarded."
        confirmLabel="Leave page"
        onConfirm={navigationGuard.confirmNavigation}
        onClose={navigationGuard.cancelNavigation}
      />
      <ConfirmationModal
        isOpen={groupPendingDeletion !== null}
        title="Delete group?"
        description={`Group ${groupPendingDeletion ?? ''} and all of its classes will be permanently deleted.`}
        confirmLabel="Delete group"
        onConfirm={() => {
          if (groupPendingDeletion) {
            void deleteGroupData(groupPendingDeletion)
              .then(refreshGroups)
              .catch(error => {
                console.error(error);
                alert(
                  'The group could not be deleted. The deletion may affect too many records for one database batch.'
                );
              });
          }
          setGroupPendingDeletion(null);
        }}
        onClose={() => setGroupPendingDeletion(null)}
      />
      <ConfirmationModal
        isOpen={classDialog?.type === 'deleteClass'}
        title="Delete class?"
        description={`Class ${classDialog?.type === 'deleteClass' ? classDialog.classID : ''} will be permanently deleted.`}
        confirmLabel="Delete class"
        onConfirm={() => {
          if (classDialog?.type === 'deleteClass') {
            const classID = classDialog.classID;
            void groupClasses
              .deleteClass(classID)
              .then(() => {
                if (activeClassID === classID) setActiveClassID(null);
              })
              .catch(error => {
                console.error(error);
                alert('The class could not be deleted.');
              });
          }
          setClassDialog(null);
        }}
        onClose={() => setClassDialog(null)}
      />
      <ConfirmationModal
        isOpen={classDialog?.type === 'discardClassChanges'}
        title="Discard unsaved class changes?"
        description={`Save or cancel the changes to class ${groupClasses.dirtyClassID ?? ''} before moving to another class.`}
        confirmLabel="Discard changes"
        onConfirm={() => {
          if (
            classDialog?.type !== 'discardClassChanges' ||
            !groupClasses.dirtyClassID
          )
            return;
          const action = classDialog.action;
          groupClasses.discardClassChanges(groupClasses.dirtyClassID);
          setClassDialog(null);
          performClassAction(action);
        }}
        onClose={() => setClassDialog(null)}
      />
      <main className="mx-auto mt-4 grid max-w-7xl gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <EditInlineTextModal
          isOpen={classDialog?.type === 'newClass'}
          text={newClassID}
          title="New class"
          setText={setNewClassID}
          onSave={() => {
            if (!resolvedGroupID) return;
            const result = groupClasses.createClass(newClassID);
            if ('error' in result) {
              alert(result.error);
              return;
            }
            setActiveClassID(result.id);
            setClassDialog(null);
          }}
          onClose={() => setClassDialog(null)}
        />
        <GroupsSidebar>
          <SchoolSidebarSection
            schools={schools}
            selectedSchoolID={selectedSchoolID}
            onSelectSchool={nextSchoolID => {
              if (groupClasses.mutatingClassID) return;
              navigationGuard.requestNavigation(async () => {
                setSchoolID(nextSchoolID);
                if (selectedGroupID) await router.push('/groups');
              });
            }}
            status={schoolsResource.status}
            isRefreshing={schoolsResource.isRefreshing}
            onRefresh={refreshSchools}
            navigationDisabled={groupClasses.mutatingClassID !== null}
          />
          <GroupSidebarSection
            groups={filteredGroups}
            selectedSchoolID={selectedSchoolID}
            selectedGroupID={resolvedGroupID}
            query={groupSearchQuery}
            onQueryChange={setGroupSearchQuery}
            onSelectGroup={selectGroup}
            onNewGroup={() => setIsOpen(true)}
            status={groupsResource.status}
            isRefreshing={groupsResource.isRefreshing}
            onRefresh={refreshGroups}
            canCreateGroup={
              selectedSchool !== undefined && groupsResource.status === 'ready'
            }
            navigationDisabled={groupClasses.mutatingClassID !== null}
          />
          {resolvedGroupID && (
            <>
              <SidebarViewTabs
                selectedView={selectedView}
                onSelectView={view =>
                  selectedGroup && selectGroup(selectedGroup.id, view)
                }
                disabled={groupClasses.mutatingClassID !== null}
              />
              {selectedView === 'classes' && (
                <ClassSidebarSection
                  groupID={resolvedGroupID}
                  classes={groupClasses.sortedClasses}
                  selectedClassID={activeClassID}
                  onSelectClass={classID =>
                    requestClassAction({ type: 'select', classID })
                  }
                  onNewClass={() => requestClassAction({ type: 'new' })}
                  canCreateClass={
                    groupClasses.isReady &&
                    !groupClasses.isRefreshing &&
                    !groupClasses.mutatingClassID
                  }
                  status={groupClasses.status}
                  navigationDisabled={groupClasses.mutatingClassID !== null}
                />
              )}
            </>
          )}
        </GroupsSidebar>
        <section className="min-w-0 space-y-3">
          {selectedGroup ? (
            <>
              <nav className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-content">
                <button
                  type="button"
                  className="hover:text-accent-hover"
                  disabled={groupClasses.mutatingClassID !== null}
                  onClick={() =>
                    navigationGuard.requestNavigation(() =>
                      router.push('/groups')
                    )
                  }
                >
                  {selectedGroupSchool?.name}
                </button>
                <span className="px-2 text-content-muted">/</span>
                <span className="font-medium">{selectedGroup.name}</span>
              </nav>
              {selectedView === 'classes' ? (
                <GroupClassEditor
                  group={selectedGroup.id}
                  selectedClassID={activeClassID}
                  classes={groupClasses.classes}
                  isClassDirty={groupClasses.isClassDirty}
                  onUpdateClass={groupClasses.updateClass}
                  onSaveClass={groupClasses.saveClass}
                  onDiscardClassChanges={groupClasses.discardClassChanges}
                  onDeleteClass={classID =>
                    setClassDialog({ type: 'deleteClass', classID })
                  }
                  isAdmin={userRole?.admin === true}
                  isReady={groupClasses.isReady}
                  onNewClass={() => requestClassAction({ type: 'new' })}
                  status={groupClasses.status}
                  isRefreshing={groupClasses.isRefreshing}
                  mutatingClassID={groupClasses.mutatingClassID}
                  hasUnsavedChanges={groupClasses.hasUnsavedChanges}
                  onRefresh={groupClasses.refresh}
                />
              ) : (
                <GroupMemberEditor
                  key={selectedGroup.id}
                  group={selectedGroup.id}
                  schoolID={selectedGroup.schoolID}
                  onUnsavedChangesChange={setHasUnsavedMemberChanges}
                />
              )}
            </>
          ) : (
            <GroupList
              school={selectedSchool}
              groups={filteredGroups}
              searchQuery={groupSearchQuery}
              onSelectGroup={selectGroup}
              onDeleteGroup={setGroupPendingDeletion}
              onNewGroup={() => setIsOpen(true)}
              status={visibleListStatus}
            />
          )}
        </section>
      </main>
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
