import { useState } from 'react';
import { getDashboardTasks } from '../data/classroomMetadata';
import { UserRole } from '../context/UserContext';
import { useAccessibleGroups, useGroupClasses } from './useClassroomMetadata';
import { useScopedSelection } from './useScopedSelection';

export const useDashboardClassroom = ({
  userID,
  userRole,
}: {
  userID: string | null;
  userRole: UserRole | null;
}) => {
  const [classRefreshVersion, setClassRefreshVersion] = useState(0);
  const groupsResource = useAccessibleGroups(userID, userRole);
  const groups = groupsResource.data;
  const [groupID, selectGroup] = useScopedSelection(
    userID,
    groups.map(group => group.id)
  );
  const classesResource = useGroupClasses(groupID, classRefreshVersion);
  const groupClasses = classesResource.data;
  const classes = groupClasses.map(groupClass => groupClass.id);
  const [classID, selectClass] = useScopedSelection(groupID, classes);
  const selectedClass = groupClasses.find(
    groupClass => groupClass.id === classID
  );
  const tasks = getDashboardTasks(selectedClass?.data.tasks ?? []);

  return {
    groupID,
    classID,
    groups,
    classes,
    tasks,
    groupsResource,
    classesResource,
    selectGroup,
    selectClass,
    refresh: () => setClassRefreshVersion(version => version + 1),
  };
};
