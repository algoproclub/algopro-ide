import { useCallback, useEffect, useState } from 'react';
import type { UserRole } from '../context/UserContext';
import {
  fetchAccessibleGroups,
  fetchGroupClasses,
  fetchGroupStudents,
  fetchManagedSchools,
  fetchSchoolGroups,
  type GroupClass,
  type GroupInfo,
  type School,
  type Student,
} from '../data/classroomMetadata';

export type ClassroomResourceStatus = 'idle' | 'loading' | 'ready' | 'error';

type ClassroomResource<T> = {
  data: T[];
  status: ClassroomResourceStatus;
  hasLoadedData: boolean;
  isRefreshing: boolean;
};

const emptyList: never[] = [];

const useClassroomList = <T>(
  scopeKey: string | null,
  load: () => Promise<T[]>,
  refreshVersion = 0
): ClassroomResource<T> => {
  const [resource, setResource] = useState<
    | {
        scopeKey: string;
        data?: T[];
        status: 'ready' | 'error';
        version: number;
      }
    | undefined
  >();

  useEffect(() => {
    if (!scopeKey) return;
    let active = true;

    load().then(
      data => {
        if (active)
          setResource({
            scopeKey,
            data,
            status: 'ready',
            version: refreshVersion,
          });
      },
      () => {
        if (!active) return;
        setResource(current =>
          current?.scopeKey === scopeKey
            ? { ...current, status: 'error', version: refreshVersion }
            : {
                scopeKey,
                status: 'error',
                version: refreshVersion,
              }
        );
      }
    );

    return () => {
      active = false;
    };
  }, [load, refreshVersion, scopeKey]);

  if (!scopeKey || resource?.scopeKey !== scopeKey)
    return {
      data: emptyList,
      status: scopeKey ? 'loading' : 'idle',
      hasLoadedData: false,
      isRefreshing: false,
    };
  if (resource.version !== refreshVersion)
    return {
      data: resource.data ?? emptyList,
      status: resource.data ? 'ready' : 'loading',
      hasLoadedData: resource.data !== undefined,
      isRefreshing: resource.data !== undefined,
    };
  return {
    data: resource.data ?? emptyList,
    status: resource.status,
    hasLoadedData: resource.data !== undefined,
    isRefreshing: false,
  };
};

const roleScopeKey = (userRole: UserRole | null) =>
  userRole
    ? JSON.stringify({
        admin: userRole.admin === true,
        teacher: Array.from(new Set(userRole.teacher ?? [])).sort(),
      })
    : null;

export const useManagedSchools = (
  userRole: UserRole | null,
  refreshVersion = 0
) => {
  const load = useCallback(() => fetchManagedSchools(userRole), [userRole]);
  return useClassroomList<School>(roleScopeKey(userRole), load, refreshVersion);
};

export const useSchoolGroups = (
  schoolID: string | null,
  {
    includeInactive = false,
    refreshVersion = 0,
  }: { includeInactive?: boolean; refreshVersion?: number } = {}
) => {
  const load = useCallback(
    () =>
      schoolID
        ? fetchSchoolGroups(schoolID, { includeInactive })
        : Promise.resolve([]),
    [includeInactive, schoolID]
  );
  return useClassroomList<GroupInfo>(
    schoolID ? `${schoolID}\0${includeInactive}` : null,
    load,
    refreshVersion
  );
};

export const useAccessibleGroups = (
  userID: string | null,
  userRole: UserRole | null
) => {
  const load = useCallback(
    () =>
      userID ? fetchAccessibleGroups(userID, userRole) : Promise.resolve([]),
    [userID, userRole]
  );
  const roleKey = roleScopeKey(userRole);
  return useClassroomList<GroupInfo>(
    userID && roleKey ? `${userID}\0${roleKey}` : null,
    load
  );
};

export const useGroupClasses = (groupID: string | null, refreshVersion = 0) => {
  const load = useCallback(
    () => (groupID ? fetchGroupClasses(groupID) : Promise.resolve([])),
    [groupID]
  );
  return useClassroomList<GroupClass>(groupID, load, refreshVersion);
};

export const useGroupStudents = (
  groupID: string | null,
  refreshVersion = 0
) => {
  const load = useCallback(
    () => (groupID ? fetchGroupStudents(groupID) : Promise.resolve([])),
    [groupID]
  );
  return useClassroomList<Student>(groupID, load, refreshVersion);
};
