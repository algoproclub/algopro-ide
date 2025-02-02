import Dropdown from '../src/components/Dropdown';
import dynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';
import { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import { Platform, PlatformProblem, StatusCode } from '../src/types/problem';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { DataSnapshot, get, getDatabase, ref } from 'firebase/database';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { Disclosure } from '@headlessui/react';
import TimeAgoLabel from '../src/components/TimeStamp';
import Checkbox from '../src/components/Checkbox';
import { parseProblem } from '../src/scripts/parseProblem';
import { getPlatformName } from '../src/scripts/getPlatformName';
import WithTeacherLogin from '../src/components/WithTeacherLogin';
import { URLProblem } from '../src/types/problem';

export const groups = ['anakonda', 'bagoly', 'capa', 'kajman', 'piton', 'sas', 'tigris'];
const times = ['1 hour', '3 hours', '1 day', '7 days', 'All'];
const timeInMs = [
  1000 * 60 * 60,
  1000 * 60 * 60 * 3,
  1000 * 60 * 60 * 24,
  1000 * 60 * 60 * 24 * 7,
  Infinity,
];

type Group = (typeof groups)[number];
type Student = {
  id: string;
  name: string;
};
export type ProblemData = {
  platform: Platform | null;
  id: string | null;
  url: string;
  source: string;
};
type VerdictType = 'accepted' | 'wrong' | 'untried' | 'error';
export type SolutionData = {
  fileID: string;
  verdict: string;
  verdictType: VerdictType;
  codeSize: number;
  lastEdit: number;
};

const firestore = getFirestore();
const database = getDatabase();
const FontAwesomeIcon = dynamic<FontAwesomeIconProps>(
  () =>
    import('@fortawesome/react-fontawesome').then(mod => mod.FontAwesomeIcon),
  {
    ssr: false,
  }
);

const getVerdictType = ({
  message,
  statusCode,
}: {
  message: string;
  statusCode: StatusCode;
}): VerdictType => {
  switch (statusCode) {
    case 'error':
      return 'error';
    case 'resolved': {
      return message === 'correct answer' ? 'accepted' : 'wrong';
    }
  }
  return 'untried';
};

const getVerdict = ({
  message,
  verdictType,
}: {
  message?: string;
  verdictType: VerdictType;
}) => {
  switch (verdictType) {
    case 'error':
      return 'error';
    case 'untried':
      return 'untried';
  }
  return message ?? '-';
};

export const fetchSolutionData = async (
  platform: Platform,
  problemID: string,
  userID: string
): Promise<SolutionData | null> => {
  const problemRef = ref(
    database,
    `users/${userID}/platform-${platform}/problem-id-to-file-id/${problemID}`
  );
  const fileID: string | undefined = (await get(problemRef)).val();

  if (!fileID) {
    return null;
  }
  const fileRef = ref(database, `files/${fileID}`);
  const fileData = (await get(fileRef)).val();

  if (!fileData.teacher) {
    return null;
  }
  const submissionRef = ref(database, `submissions/${fileID}/statusData`);
  const submissionData = (await get(submissionRef)).val();

  const verdictType = submissionData
    ? getVerdictType(submissionData)
    : 'untried';
  const verdict = getVerdict({
    message: submissionData?.message,
    verdictType,
  });

  return {
    fileID: fileID,
    verdict: verdict,
    verdictType: verdictType,
    codeSize: fileData.teacher.codeSize,
    lastEdit: fileData.teacher.editTime,
  };
};

export const fetchProblems = async (
  group: Group,
  classID?: string
): Promise<ProblemData[]> => {
  if (!classID) {
    return [];
  }
  const problems: URLProblem[] | undefined = (
    await getDoc(doc(firestore, 'groups', group, 'classes', classID))
  ).data()?.tasks;

  if (!problems) {
    return [];
  }
  return problems.map(({ url }) => {
    const parsed = parseProblem(url);
    return {
      id: parsed.id,
      platform: parsed.platform,
      source:
        parsed.id && parsed.platform
          ? getPlatformName(parsed.platform) + ' - ' + parsed.id
          : parsed.url,
      url: url,
    };
  });
};

const fetchStudents = async (group: Group): Promise<Student[]> => {
  const results = await getDocs(
    query(
      collection(firestore, 'userdata'),
      where('groups', 'array-contains', group)
    )
  );
  const users: Student[] = [];
  results.forEach(doc => {
    users.push({ id: doc.id, name: doc.data().user_full_name });
  });
  return users;
};

export const fetchClasses = async (group: Group) => {
  const classes: string[] = [];
  const results = await getDocs(
    query(
      collection(firestore, 'groups', group, 'classes'),
      orderBy('creationTime', 'desc')
    )
  );
  results.forEach(doc => {
    classes.push(doc.id);
  });
  return classes;
};

const RefreshButton = ({ onRefresh }: { onRefresh: () => void }) => {
  return (
    <button
      className="flex items-center justify-center border border-gray-600 px-4 py-3.5 -mb-1 rounded-lg hover:border-gray-500 bg-gray-900 hover:bg-gray-800 active:bg-gray-700"
      onClick={onRefresh}
    >
      <FontAwesomeIcon
        icon={{ prefix: 'fas', iconName: 'arrows-rotate' }}
        className="w-4 text-gray-100"
      />
    </button>
  );
};

const Controls = ({
  group,
  classID,
  time,
  highlight,
  classes,
  setGroup,
  setClassID,
  setTime,
  toggleHighlight,
  onRefresh,
}: {
  group: number;
  classID: number;
  time: number;
  classes: string[];
  highlight: boolean;
  setGroup: (_: number) => void;
  setClassID: (_: number) => void;
  setTime: (_: number) => void;
  toggleHighlight: () => void;
  onRefresh: () => void;
}) => {
  return (
    <div className="bg-gray-800 w-full space-y-2.5 px-5 py-3.5 border border-gray-600">
      <div className="w-full flex space-x-2 items-end">
        <Dropdown
          items={groups}
          label="Group"
          selected={group}
          setSelected={setGroup}
        />
        <Dropdown
          items={classes}
          label="Class"
          selected={classID}
          setSelected={setClassID}
        />
        <Dropdown
          items={times}
          label="Last edit"
          selected={time}
          setSelected={setTime}
        />
        <RefreshButton onRefresh={onRefresh} />
      </div>
      <Checkbox
        checked={highlight}
        toggleChecked={toggleHighlight}
        label="Highlight last edited file"
      />
    </div>
  );
};

const ControlDropdown = ({
  group,
  classID,
  time,
  highlight,
  classes,
  setGroup,
  setClassID,
  setTime,
  toggleHighlight,
  onRefresh,
}: {
  group: number;
  classID: number;
  time: number;
  classes: string[];
  highlight: boolean;
  setGroup: (_: number) => void;
  setClassID: (_: number) => void;
  setTime: (_: number) => void;
  toggleHighlight: () => void;
  onRefresh: () => void;
}) => {
  useEffect(() => {
    setClassID(0);
  }, [group]);

  return (
    <Disclosure>
      {({ open }) => (
        <div className="space-y-2">
          <div className="w-full flex items-stretch space-x-2">
            <Disclosure.Button className="w-full">
              <div
                className={`flex items-center justify-center w-full border px-4 py-2.5 rounded-md border-gray-600 hover:border-gray-500 text-[0.95rem] ${
                  open ? 'bg-gray-800' : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >
                Filter
                <FontAwesomeIcon
                  icon={{ prefix: 'fas', iconName: 'chevron-down' }}
                  className={`ml-2 w-3.5 h-3.5 transform duration-200 ${
                    open ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </div>
            </Disclosure.Button>
            <button
              className="flex items-center justify-center border border-gray-600 px-4 py-1 rounded-lg hover:border-gray-500 bg-gray-900 hover:bg-gray-800 active:bg-gray-700"
              onClick={onRefresh}
            >
              <FontAwesomeIcon
                icon={{ prefix: 'fas', iconName: 'arrows-rotate' }}
                className="w-4 text-gray-100"
              />
            </button>
          </div>
          <Disclosure.Panel className="px-5 py-6 relative space-y-4 border border-gray-600">
            <Dropdown
              items={groups}
              label="Group"
              selected={group}
              setSelected={setGroup}
            />
            <Dropdown
              items={classes}
              label="Class"
              selected={classID}
              setSelected={setClassID}
            />
            <Dropdown
              items={times}
              label="Last edit"
              selected={time}
              setSelected={setTime}
            />
            <Checkbox
              checked={highlight}
              toggleChecked={toggleHighlight}
              label="Highlight last edited file"
            />
          </Disclosure.Panel>
        </div>
      )}
    </Disclosure>
  );
};

const GroupData = ({
  problems,
  students,
  data,
  highlight,
  fromTime,
}: {
  problems: ProblemData[];
  students: Student[];
  data: (SolutionData | null)[][];
  highlight: boolean;
  fromTime: number;
}) => {
  if (
    students.length !== data.length ||
    (data.length > 0 && problems.length !== data[0].length)
  ) {
    return <></>;
  }
  const mostRecent = students.map((_, i) => {
    return Math.max.apply(
      Math,
      data[i].map(item => item?.lastEdit ?? 0)
    );
  });
  return (
    <div className="border border-gray-600 overflow-auto max-h-[40rem]">
      <table className="table-auto data-table text-sm w-full !border-separate !border-spacing-0 divide-y divide-gray-600">
        <thead>
          <tr className="divide-x divide-gray-700 bg-gray-800">
            <th className="!sticky !top-0 !left-0 !z-40 bg-gray-800 border-r border-gray-700 border-b"></th>
            <>
              {problems.map((problem, index) => (
                <th
                  key={index}
                  className={`w-60 ${
                    index == 0 ? '!border-l-0' : ''
                  } !sticky top-0 !z-30 bg-gray-800 border-b`}
                >
                  <a
                    href={problem.url}
                    className="hover:text-indigo-200 underline underline-offset-2 truncate"
                    target="_blank"
                  >
                    <span>{problem.source}</span>
                    <ArrowTopRightOnSquareIcon
                      aria-hidden="true"
                      className="ml-1.5 h-[1.1rem] w-[1.1rem] inline"
                    />
                  </a>
                </th>
              ))}
            </>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-600">
          {students.map((student, i) => (
            <tr key={i} className="divide-x divide-gray-600">
              <td className="bg-gray-800 sticky left-0 !z-20 px-4 py-3 border-r border-b border-gray-600">
                {student.name}
              </td>
              <>
                {data[i].map((_, j) => (
                  <td
                    key={j}
                    className={`relative ${
                      j == 0 ? '!border-l-0' : ''
                    } border-b`}
                  >
                    {data[i][j] && (
                      <>
                        {data[i][j]?.lastEdit === mostRecent[i] &&
                          highlight && (
                            <div className="absolute bg-indigo-700 inset-0" />
                          )}
                        <div
                          className={`relative z-10 bg-gray-900 flex flex-col divide-y divide-[#2d2d2d] ${
                            data[i][j]?.lastEdit === mostRecent[i] && highlight
                              ? 'border border-indigo-900 -m-[1px] opacity-90'
                              : (data[i][j]?.lastEdit ?? 0) >= fromTime
                              ? ''
                              : 'opacity-50'
                          }`}
                        >
                          <div className="truncate w-full px-4 py-1.5">
                            <a
                              className="underline hover:text-indigo-200 mr-2"
                              href={`/${data[i][j]!.fileID.slice(1)}`}
                              target="_blank"
                            >
                              {data[i][j]!.verdict[0].toUpperCase() +
                                data[i][j]!.verdict.slice(1)}
                            </a>
                            <span>
                              {data[i][j]!.verdictType === 'wrong' && (
                                <FontAwesomeIcon
                                  icon={{ prefix: 'fas', iconName: 'xmark' }}
                                  className="text-red-500"
                                />
                              )}
                              {data[i][j]!.verdictType === 'accepted' && (
                                <FontAwesomeIcon
                                  icon={{ prefix: 'fas', iconName: 'check' }}
                                  className="text-green-500"
                                />
                              )}
                              {data[i][j]!.verdictType === 'error' && (
                                <FontAwesomeIcon
                                  icon={{
                                    prefix: 'fas',
                                    iconName: 'triangle-exclamation',
                                  }}
                                  className="text-yellow-500"
                                />
                              )}
                            </span>
                          </div>
                          <div className="truncate w-full px-4 py-1.5 bg-[#202020]">
                            {data[i][j]!.codeSize} char
                          </div>
                          <div className="truncate w-full px-4 py-1.5">
                            <TimeAgoLabel
                              date={new Date(data[i][j]!.lastEdit)}
                            />
                          </div>
                        </div>
                      </>
                    )}
                    {!data[i][j] && (
                      <div className="absolute inset-0 bg-gray-900 flex items-center w-full text-gray-400 px-4 py-3">
                        No corresponding file
                      </div>
                    )}
                  </td>
                ))}
              </>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PageContent = () => {
  const [group, setGroup] = useState(0);
  const [time, setTime] = useState(0);
  const [classID, setClassID] = useState(0);
  const [highlight, setHighlight] = useState(false);
  const [classes, setClasses] = useState<string[]>([]);
  const [problems, setProblems] = useState<ProblemData[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [data, setData] = useState<(SolutionData | null)[][]>([]);

  document.title = 'Teacher interface - AlgoPro IDE';

  useEffect(() => {
    fetchClasses(groups[group]).then(res => {
      setClasses(res);
    });
    const timeout = setInterval(() => {
      handleRefresh();
    }, 15000);

    return () => {
      clearTimeout(timeout);
    };
  }, [groups, group]);

  useEffect(() => {
    handleRefresh();
  }, [group, classID]);

  useEffect(() => {
    const updateData = async () => {
      const problemsPromise = Promise.all(
        problems
          .filter(problem => problem.id && problem.platform)
          .map(problem => {
            return Promise.all(
              students.map(student => {
                return fetchSolutionData(
                  problem.platform!,
                  problem.id!,
                  student.id
                );
              })
            );
          })
      );
      setData(await problemsPromise);
    };
    updateData();
  }, [problems, students]);

  useEffect(() => {
    const updateProblems = async () => {
      setProblems(await fetchProblems(groups[group], classes[classID]));
    };
    updateProblems();
  }, [classes]);

  const handleRefresh = async () => {
    setClasses(await fetchClasses(groups[group]));
    setStudents(await fetchStudents(groups[group]));
  };
  const transpose = (array: (SolutionData | null)[][]) => {
    return array.length > 0
      ? array[0].map((_, j) => array.map(row => row[j]))
      : [];
  };
  const currentTime = Date.now();
  const problemWithID = problems.map((problem, i) => {
    return !!problem.id;
  });
  const filteredProblems = problems.filter((_, i) => problemWithID[i]);
  const transposed = transpose(data);

  const fromTime = currentTime - timeInMs[time];
  const hasSolution = transposed.map(solutions =>
    solutions.some(sol => sol !== null && sol.lastEdit >= fromTime)
  );
  const filteredStudents = students.filter((_, i) => hasSolution[i]);
  const filteredData = transposed.filter((_, i) => hasSolution[i]);

  return (
    <div className="px-2">
      <div className="mx-auto max-w-7xl mt-4 space-y-4">
        <div className="md:hidden">
          <ControlDropdown
            group={group}
            classID={classID}
            time={time}
            classes={classes}
            highlight={highlight}
            setGroup={index => setGroup(index)}
            setClassID={index => setClassID(index)}
            setTime={index => setTime(index)}
            toggleHighlight={() => setHighlight(val => !val)}
            onRefresh={handleRefresh}
          />
        </div>
        <div className="hidden md:block">
          <Controls
            group={group}
            classID={classID}
            time={time}
            classes={classes}
            highlight={highlight}
            setGroup={index => setGroup(index)}
            setClassID={index => setClassID(index)}
            setTime={index => setTime(index)}
            toggleHighlight={() => setHighlight(val => !val)}
            onRefresh={handleRefresh}
          />
        </div>
        <GroupData
          problems={filteredProblems}
          students={filteredStudents}
          data={filteredData}
          highlight={highlight}
          fromTime={fromTime}
        />
      </div>
    </div>
  );
};

export default function TeacherPage() {
  return (
    <WithTeacherLogin>
      <PageContent />
    </WithTeacherLogin>
  );
}
