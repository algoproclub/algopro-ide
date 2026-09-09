import React, { useEffect, useState } from 'react';
import { MinusIcon, PlusIcon } from '@heroicons/react/20/solid';
import { Combobox } from '@headlessui/react';
import Fuse from 'fuse.js';
import { useNullableUserContext } from '../../context/UserContext';
import {
  fetchGroupRoster,
  fetchSchoolStudents,
  saveGroupMemberships,
  type Student,
} from '../../data/classroomMetadata';
import RefreshButton from '../RefreshButton';

type MembershipState = {
  students: Student[];
  savedMemberUIDs: Set<string>;
  pendingMemberships: Record<string, boolean>;
  status: 'ready' | 'loading' | 'saving' | 'error';
};

const initialState: MembershipState = {
  students: [],
  savedMemberUIDs: new Set(),
  pendingMemberships: {},
  status: 'loading',
};

const schoolStudentCache = new Map<string, Student[]>();

const getSchoolCacheKey = (userID: string, schoolID: string) =>
  `${userID}:${schoolID}`;

function useGroupMembers(groupID: string, schoolID: string) {
  const { firebaseUser } = useNullableUserContext();
  const [state, setState] = useState(initialState);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    if (!firebaseUser) return;
    let isCurrent = true;
    const loadStudents = async () => {
      const forceRefresh = refreshNonce > 0;
      const schoolCacheKey = getSchoolCacheKey(firebaseUser.uid, schoolID);
      const cachedStudents = schoolStudentCache.get(schoolCacheKey);
      const loadSchoolRoster = forceRefresh || !cachedStudents;
      const result = loadSchoolRoster
        ? await fetchSchoolStudents(groupID)
        : await fetchGroupRoster(groupID);
      if (result.schoolID !== schoolID)
        throw new Error('The returned school does not match the group.');
      const students = loadSchoolRoster
        ? result.students
        : Array.from(
            new Map(
              [...result.students, ...cachedStudents].map(student => [
                student.id,
                student,
              ])
            ).values()
          ).sort((left, right) => left.name.localeCompare(right.name));

      const memberUIDs = new Set(result.memberUIDs);
      schoolStudentCache.set(schoolCacheKey, students);
      return { students, memberUIDs };
    };
    loadStudents()
      .then(loaded => {
        if (loaded && isCurrent) {
          setState({
            students: loaded.students,
            savedMemberUIDs: loaded.memberUIDs,
            pendingMemberships: {},
            status: 'ready',
          });
        }
      })
      .catch(error => {
        if (isCurrent) {
          setState(current => ({
            ...current,
            status: 'error',
          }));
          console.error(error);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [firebaseUser, groupID, refreshNonce, schoolID]);

  const students = state.students.map(student => ({
    ...student,
    isInGroup:
      state.pendingMemberships[student.id] ??
      state.savedMemberUIDs.has(student.id),
  }));

  const saveMemberships = async () => {
    const changes = Object.entries(state.pendingMemberships);
    if (!changes.length || state.status !== 'ready' || !firebaseUser) return;
    setState(current => ({ ...current, status: 'saving' }));
    try {
      await saveGroupMemberships(groupID, changes);

      const memberUIDs = new Set(state.savedMemberUIDs);
      changes.forEach(([uid, isInGroup]) => {
        if (isInGroup) memberUIDs.add(uid);
        else memberUIDs.delete(uid);
      });
      setState(current => ({
        ...current,
        savedMemberUIDs: memberUIDs,
        pendingMemberships: {},
        status: 'ready',
      }));
    } catch (error) {
      setState(current => ({ ...current, status: 'ready' }));
      console.error(error);
      alert('The membership changes could not be saved.');
    }
  };

  const toggleMembership = (uid: string) =>
    setState(current => {
      if (current.status !== 'ready') return current;
      const savedMembership = current.savedMemberUIDs.has(uid);
      const nextMembership = !(
        current.pendingMemberships[uid] ?? savedMembership
      );
      const pendingMemberships = { ...current.pendingMemberships };
      if (nextMembership === savedMembership) delete pendingMemberships[uid];
      else pendingMemberships[uid] = nextMembership;
      return { ...current, pendingMemberships };
    });
  const discardMembershipChanges = () =>
    setState(current => ({ ...current, pendingMemberships: {} }));
  const refresh = () => {
    setState(current => ({ ...current, status: 'loading' }));
    setRefreshNonce(value => value + 1);
  };

  return {
    students,
    status: state.status,
    pendingChangeCount: Object.keys(state.pendingMemberships).length,
    toggleMembership,
    discardMembershipChanges,
    saveMemberships,
    refresh,
  };
}

export default function GroupMemberEditor({
  group,
  schoolID,
  onUnsavedChangesChange,
}: {
  group: string;
  schoolID: string;
  onUnsavedChangesChange: (hasUnsavedChanges: boolean) => void;
}) {
  const {
    students,
    status,
    pendingChangeCount,
    toggleMembership,
    discardMembershipChanges,
    saveMemberships,
    refresh,
  } = useGroupMembers(group, schoolID);
  const [showAllStudents, setShowAllStudents] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  useEffect(() => {
    onUnsavedChangesChange(pendingChangeCount > 0);
  }, [onUnsavedChangesChange, pendingChangeCount]);
  useEffect(
    () => () => onUnsavedChangesChange(false),
    [onUnsavedChangesChange]
  );

  const normalizedQuery = searchQuery.trim();
  const studentSearch = new Fuse(
    students.filter(student => !student.isInGroup),
    {
      keys: ['name', 'email'],
      threshold: 0.35,
      ignoreLocation: true,
    }
  );
  const filteredSuggestions = normalizedQuery
    ? studentSearch
        .search(normalizedQuery, { limit: 20 })
        .map(result => result.item)
    : [];

  const listStudents = students.filter(
    data => showAllStudents || data.isInGroup
  );
  const isLoading = status === 'loading';
  const isSaving = status === 'saving';
  const isUnavailable = status === 'error';

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface-raised text-content">
      <header className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <div>
          <h1 className="font-semibold">Members</h1>
          <div className="flex min-h-5 items-center gap-1.5">
            <p className="text-sm text-content-muted">
              Manage this group’s students.
            </p>
            <span
              className={`inline-flex min-w-28 justify-center rounded-full bg-status-warning-surface px-2 py-0.5 text-xs font-medium text-status-warning-content ${
                pendingChangeCount ? '' : 'invisible'
              }`}
            >
              {pendingChangeCount} unsaved change
              {pendingChangeCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            className="ui-button-primary px-4 py-2"
            onClick={saveMemberships}
            disabled={!pendingChangeCount || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
          <RefreshButton
            title={
              pendingChangeCount
                ? 'Save or cancel changes before refreshing students'
                : 'Refresh names, email addresses, and memberships from the server'
            }
            onClick={refresh}
            disabled={isSaving || pendingChangeCount > 0}
            isLoading={isLoading}
          />
        </div>
      </header>
      {isUnavailable && (
        <p className="border-b border-danger px-3 py-2 text-sm text-danger">
          The student list could not be loaded. Try refreshing it.
        </p>
      )}
      <Combobox
        value={null}
        nullable
        onChange={(studentID: string | null) => {
          if (studentID) toggleMembership(studentID);
          setSearchQuery('');
        }}
        disabled={isLoading || isSaving || isUnavailable}
      >
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <Combobox.Label className="text-sm text-content-muted">
            Add student:
          </Combobox.Label>
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-full">
              <Combobox.Input
                className="w-full rounded-md border border-line bg-input px-3 py-2 text-content shadow-sm outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
                placeholder="Search by full name or email…"
                type="text"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Escape') setSearchQuery('');
                }}
              />
              {normalizedQuery.length > 0 && (
                <Combobox.Options className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-line bg-surface-raised text-content shadow-lg">
                  {filteredSuggestions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-content-muted">
                      No matches.
                    </div>
                  ) : (
                    filteredSuggestions.map(data => (
                      <Combobox.Option
                        key={data.id}
                        value={data.id}
                        className={({ active }) =>
                          `cursor-pointer px-3 py-2 ${active ? 'bg-surface-hover' : ''}`
                        }
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate">{data.name}</span>
                            {data.email && (
                              <span className="block truncate text-xs text-content-muted">
                                {data.email}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-xs text-content-muted">
                            Add
                          </span>
                        </span>
                      </Combobox.Option>
                    ))
                  )}
                </Combobox.Options>
              )}
            </div>
            <button
              className="ui-button-secondary whitespace-nowrap py-2.5"
              onClick={() => setShowAllStudents(prev => !prev)}
            >
              {showAllStudents ? 'List all members' : 'List all students'}
            </button>
          </div>
        </div>
      </Combobox>
      <div className="min-h-4 w-full divide-y divide-line-muted bg-surface text-content">
        {isLoading && !listStudents.length && (
          <p className="px-4 py-10 text-center text-sm text-content-muted">
            Loading students…
          </p>
        )}
        {listStudents.map(data => (
          <div key={data.id} className="flex items-center justify-between">
            <div className="min-w-0 p-4">
              <div className="truncate">{data.name}</div>
              {data.email && (
                <div className="truncate text-sm text-content-muted">
                  {data.email}
                </div>
              )}
            </div>
            <div className="px-4 py-2.5">
              <button
                onClick={() => toggleMembership(data.id)}
                className={`ui-button border-transparent text-content-inverted ${
                  data.isInGroup
                    ? 'bg-danger enabled:hover:bg-status-danger'
                    : 'bg-success enabled:hover:bg-status-success'
                }`}
                disabled={isLoading || isSaving || isUnavailable}
              >
                {data.isInGroup ? 'Remove' : 'Add'}
                {data.isInGroup ? (
                  <MinusIcon className="h-4 w-4" />
                ) : (
                  <PlusIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        ))}
        {!isLoading && !isUnavailable && !listStudents.length && (
          <p className="px-4 py-10 text-center text-sm text-content-muted">
            {showAllStudents
              ? 'No students are available in this school.'
              : 'This group has no members yet.'}
          </p>
        )}
      </div>
      <footer className="flex justify-end gap-2 border-t border-line px-3 py-2.5">
        <button
          type="button"
          className="ui-button-secondary py-2"
          onClick={discardMembershipChanges}
          disabled={!pendingChangeCount || isSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="ui-button-primary px-4 py-2"
          onClick={saveMemberships}
          disabled={!pendingChangeCount || isSaving}
        >
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </footer>
    </section>
  );
}
