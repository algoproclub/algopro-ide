import { get, getDatabase, onValue, ref } from 'firebase/database';
import { Platform, platforms, StatusData } from '../types/problem';
import { fetchGroupStudents, type TaskStatusTarget } from './classroomMetadata';

const database = getDatabase();

export type VerdictType = 'accepted' | 'wrong' | 'untried' | 'error';

export type TaskStatus = {
  fileID: string;
  verdict: string;
  verdictType: VerdictType;
  codeSize: number;
  lastEdit: number;
};

export type TaskStatusState =
  | { status: 'loading' }
  | { status: 'ready'; data: TaskStatus | null }
  | { status: 'error' };

export type ClassTaskSummary = Record<string, Record<string, TaskStatusState>>;

export type ProblemKey = `${Platform}:${string}`;
export type GroupSolvedCounts = {
  studentCount: number;
  problems: Record<ProblemKey, number>;
};

// This one-time adapter deliberately reads only the solved maps. A future
// group progress projection can replace it without changing the Problems page.
export const fetchGroupSolvedCounts = async (
  groupID: string
): Promise<GroupSolvedCounts> => {
  const students = await fetchGroupStudents(groupID);
  const solvedByStudent = await Promise.all(
    students.map(student =>
      Promise.all(
        platforms.map(async platform => {
          const snapshot = await get(
            ref(database, `users/${student.id}/platform-${platform}/solved`)
          );
          return [platform, snapshot.val() ?? {}] as const;
        })
      )
    )
  );
  const problems: Record<ProblemKey, number> = {};
  solvedByStudent.forEach(solvedByPlatform => {
    solvedByPlatform.forEach(([platform, solved]) => {
      Object.keys(solved).forEach(problemID => {
        const key: ProblemKey = `${platform}:${problemID}`;
        problems[key] = (problems[key] ?? 0) + 1;
      });
    });
  });
  return { studentCount: students.length, problems };
};

type FileTeacherData = {
  codeSize: number;
  editTime: number;
};

const getVerdictType = ({ message, statusCode }: StatusData): VerdictType => {
  switch (statusCode) {
    case 'error':
      return 'error';
    case 'resolved':
      return message === 'correct answer' ? 'accepted' : 'wrong';
  }
  return 'untried';
};

const createTaskStatus = (
  fileID: string,
  fileData: FileTeacherData | null,
  submissionData: StatusData | null
): TaskStatus | null => {
  if (!fileData) return null;

  const verdictType = submissionData
    ? getVerdictType(submissionData)
    : 'untried';
  return {
    fileID,
    verdict:
      verdictType === 'error'
        ? 'error'
        : verdictType === 'untried'
          ? 'untried'
          : (submissionData?.message ?? '-'),
    verdictType,
    codeSize: fileData.codeSize,
    lastEdit: fileData.editTime,
  };
};

const subscribeToTaskStatusForFile = (
  fileID: string,
  onChange: (status: TaskStatus | null) => void,
  onError: () => void
) => {
  let fileData: FileTeacherData | null | undefined;
  let submissionData: StatusData | null | undefined;
  const update = () => {
    if (fileData !== undefined && submissionData !== undefined) {
      onChange(createTaskStatus(fileID, fileData, submissionData));
    }
  };

  const unsubscribeFile = onValue(
    ref(database, `files/${fileID}/teacher`),
    snapshot => {
      fileData = snapshot.val();
      update();
    },
    onError
  );
  const unsubscribeSubmission = onValue(
    ref(database, `submissions/${fileID}/statusData`),
    snapshot => {
      submissionData = snapshot.val();
      update();
    },
    onError
  );

  return () => {
    unsubscribeFile();
    unsubscribeSubmission();
  };
};

const subscribeToTaskStatus = (
  userID: string,
  target: TaskStatusTarget,
  onChange: (state: TaskStatusState) => void
) => {
  const mappingRef = ref(
    database,
    `users/${userID}/platform-${target.platform}/problem-id-to-file-id/${target.id}`
  );
  let active = true;
  let unsubscribeMapping = () => {};
  let unsubscribeStatus = () => {};

  unsubscribeMapping = onValue(
    mappingRef,
    snapshot => {
      if (!active) return;
      unsubscribeStatus();
      unsubscribeStatus = () => {};
      const fileID = snapshot.val();
      if (typeof fileID !== 'string' || fileID.length === 0) {
        onChange({ status: 'ready', data: null });
        return;
      }

      onChange({ status: 'loading' });
      unsubscribeStatus = subscribeToTaskStatusForFile(
        fileID,
        status => {
          if (active) onChange({ status: 'ready', data: status });
        },
        () => {
          if (active) onChange({ status: 'error' });
        }
      );
    },
    () => {
      if (active) onChange({ status: 'error' });
    }
  );

  return () => {
    active = false;
    unsubscribeMapping();
    unsubscribeStatus();
  };
};

// Keep the classroom scope in this boundary so a future denormalized class
// projection can replace the current per-file listeners without UI changes.
export const subscribeToClassTaskSummary = (
  {
    studentIDs,
    tasks,
  }: {
    schoolID: string;
    groupID: string;
    classID: string;
    studentIDs: string[];
    tasks: TaskStatusTarget[];
  },
  onChange: (summary: ClassTaskSummary) => void
) => {
  let summary: ClassTaskSummary = Object.fromEntries(
    studentIDs.map(studentID => [
      studentID,
      Object.fromEntries(
        tasks.map(task => [task.key, { status: 'loading' } as const])
      ),
    ])
  );

  const updateTask = (
    studentID: string,
    taskKey: string,
    state: TaskStatusState
  ) => {
    summary = {
      ...summary,
      [studentID]: { ...summary[studentID], [taskKey]: state },
    };
    onChange(summary);
  };

  onChange(summary);
  const unsubscribes = studentIDs.flatMap(studentID =>
    tasks.map(task =>
      subscribeToTaskStatus(studentID, task, state =>
        updateTask(studentID, task.key, state)
      )
    )
  );

  return () => unsubscribes.forEach(unsubscribe => unsubscribe());
};
