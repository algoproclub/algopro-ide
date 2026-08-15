import { useEffect, useState } from 'react';
import type { TaskStatusTarget } from '../data/classroomMetadata';
import {
  ClassTaskSummary,
  subscribeToClassTaskSummary,
  TaskStatusState,
} from '../data/taskStatus';

export type ClassTaskScope = {
  schoolID: string | null;
  groupID: string | null;
  classID: string | null;
};

type ClassTaskSubscription = ClassTaskScope & {
  studentIDs: string[];
  tasks: TaskStatusTarget[];
};

export const useClassTaskStatuses = ({
  schoolID,
  groupID,
  classID,
  studentIDs,
  tasks,
}: ClassTaskScope & {
  studentIDs: string[];
  tasks: TaskStatusTarget[];
}) => {
  // Metadata refreshes create new arrays. Key the effect by their contents so
  // unchanged cells keep their existing live listeners.
  const scopeKey = JSON.stringify({
    schoolID,
    groupID,
    classID,
    studentIDs,
    tasks,
  });
  const [resource, setResource] = useState<{
    scopeKey: string | null;
    summary: ClassTaskSummary | null;
  }>({ scopeKey: null, summary: null });

  useEffect(() => {
    const subscription = JSON.parse(scopeKey) as ClassTaskSubscription;
    if (
      !subscription.schoolID ||
      !subscription.groupID ||
      !subscription.classID
    )
      return;

    return subscribeToClassTaskSummary(
      {
        schoolID: subscription.schoolID,
        groupID: subscription.groupID,
        classID: subscription.classID,
        studentIDs: subscription.studentIDs,
        tasks: subscription.tasks,
      },
      summary => {
        setResource({ scopeKey, summary });
      }
    );
  }, [scopeKey]);

  return resource.scopeKey === scopeKey ? resource.summary : null;
};

export const useStudentTaskStatuses = ({
  userID,
  targets,
  ...scope
}: ClassTaskScope & {
  userID: string | null;
  targets: TaskStatusTarget[];
}): Record<string, TaskStatusState> => {
  const summary = useClassTaskStatuses({
    ...scope,
    studentIDs: userID ? [userID] : [],
    tasks: targets,
  });

  return Object.fromEntries<TaskStatusState>(
    targets.map(target => {
      const state = userID ? summary?.[userID]?.[target.key] : undefined;
      return [target.key, state ?? { status: 'loading' }] as const;
    })
  );
};
