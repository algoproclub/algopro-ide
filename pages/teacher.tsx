import Dropdown from '../src/components/Dropdown';
import dynamic from 'next/dynamic';
import React, { useState } from 'react';
import { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { Disclosure } from '@headlessui/react';
import TimeAgoLabel from '../src/components/TimeStamp';
import Checkbox from '../src/components/Checkbox';
import WithTeacherLogin from '../src/components/WithTeacherLogin';
import { useUserContext } from '../src/context/UserContext';
import PageTitle from '../src/components/PageTitle';
import RefreshButton from '../src/components/RefreshButton';
import {
  getDashboardTasks,
  type ClassTask,
  type Student,
} from '../src/data/classroomMetadata';
import type { TaskStatus } from '../src/data/taskStatus';
import {
  useSchoolGroups,
  useGroupClasses,
  useGroupStudents,
  useManagedSchools,
} from '../src/hooks/useClassroomMetadata';
import { useScopedSelection } from '../src/hooks/useScopedSelection';
import { useClassTaskStatuses } from '../src/hooks/useStudentTaskStatuses';

const times = ['1 hour', '3 hours', '1 day', '7 days', 'All'];
const timeInMs = [
  1000 * 60 * 60,
  1000 * 60 * 60 * 3,
  1000 * 60 * 60 * 24,
  1000 * 60 * 60 * 24 * 7,
  Infinity,
];
const FontAwesomeIcon = dynamic<FontAwesomeIconProps>(
  () =>
    import('@fortawesome/react-fontawesome').then(mod => mod.FontAwesomeIcon),
  { ssr: false }
);

const secondaryButtonClass =
  'border theme-border text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)]';
const tableBorderClass = 'divide-[color:var(--border-muted)]';
const tableCellSurfaceClass = 'bg-[color:var(--table-row-bg)]';
const tableCellAltSurfaceClass = 'bg-[color:var(--table-row-alt-bg)]';
const Controls = ({
  schoolInd,
  groupInd,
  classInd,
  timeInd,
  highlight,
  schoolNames,
  groupNames,
  classes,
  setSchoolInd,
  setGroupInd,
  setClassInd,
  setTimeInd,
  toggleHighlight,
  onRefresh,
  isRefreshing,
}: {
  schoolInd: number;
  groupInd: number;
  classInd: number;
  timeInd: number;
  highlight: boolean;
  schoolNames: string[];
  groupNames: string[];
  classes: string[];
  setSchoolInd: (_: number) => void;
  setGroupInd: (_: number) => void;
  setClassInd: (_: number) => void;
  setTimeInd: (_: number) => void;
  toggleHighlight: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) => {
  return (
    <div className="theme-surface-raised w-full space-y-2.5 px-5 py-3.5 border theme-border">
      <div className="w-full flex space-x-2 items-end">
        <Dropdown
          items={schoolNames}
          label="School"
          selected={schoolInd}
          setSelected={setSchoolInd}
        />
        <Dropdown
          items={groupNames}
          label="Group"
          selected={groupInd}
          setSelected={setGroupInd}
        />
        <Dropdown
          items={classes}
          label="Class"
          selected={classInd}
          setSelected={setClassInd}
        />
        <Dropdown
          items={times}
          label="Last edit"
          selected={timeInd}
          setSelected={setTimeInd}
        />
        <RefreshButton
          onClick={onRefresh}
          title="Refresh groups, classes and students"
          isLoading={isRefreshing}
        />
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
  schoolInd,
  groupInd,
  classInd,
  timeInd,
  highlight,
  schoolNames,
  groupNames,
  classes,
  setSchoolInd,
  setGroupInd,
  setClassInd,
  setTimeInd,
  toggleHighlight,
  onRefresh,
  isRefreshing,
}: {
  schoolInd: number;
  groupInd: number;
  classInd: number;
  timeInd: number;
  highlight: boolean;
  schoolNames: string[];
  groupNames: string[];
  classes: string[];
  setSchoolInd: (_: number) => void;
  setGroupInd: (_: number) => void;
  setClassInd: (_: number) => void;
  setTimeInd: (_: number) => void;
  toggleHighlight: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) => {
  return (
    <Disclosure>
      {({ open }) => (
        <div className="space-y-2">
          <div className="w-full flex items-stretch space-x-2">
            <Disclosure.Button className="w-full">
              <div
                className={`flex items-center justify-center w-full border px-4 py-2.5 rounded-md text-[0.95rem] ${
                  open
                    ? 'theme-border bg-[color:var(--surface-hover)]'
                    : secondaryButtonClass
                }`}
              >
                Filter
                <FontAwesomeIcon
                  icon={{ prefix: 'fas', iconName: 'chevron-down' }}
                  className={`ml-2 w-3.5 h-3.5 inline transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
                />
              </div>
            </Disclosure.Button>
            <RefreshButton
              onClick={onRefresh}
              title="Refresh groups, classes and students"
              isLoading={isRefreshing}
            />
          </div>
          <Disclosure.Panel className="px-5 py-6 relative space-y-4 border theme-border theme-surface-raised">
            <Dropdown
              items={schoolNames}
              label="School"
              selected={schoolInd}
              setSelected={setSchoolInd}
            />
            <Dropdown
              items={groupNames}
              label="Group"
              selected={groupInd}
              setSelected={setGroupInd}
            />
            <Dropdown
              items={classes}
              label="Class"
              selected={classInd}
              setSelected={setClassInd}
            />
            <Dropdown
              items={times}
              label="Last edit"
              selected={timeInd}
              setSelected={setTimeInd}
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
  problems: ClassTask[];
  students: Student[];
  data: (TaskStatus | null)[][];
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
    return Math.max(...data[i].map(item => item?.lastEdit ?? 0));
  });
  return (
    <div className="border theme-border overflow-auto max-h-[40rem]">
      <table className="table-auto data-table text-sm w-full !border-separate !border-spacing-0 divide-y divide-[color:var(--border-color)] theme-table">
        <thead>
          <tr className="divide-x divide-[color:var(--border-muted)] theme-table-header">
            <th className="!sticky !top-0 !left-0 !z-40 theme-table-header border-r border-[color:var(--border-muted)] border-b"></th>
            <>
              {problems.map((problem, index) => (
                <th
                  key={index}
                  className={`w-60 ${index == 0 ? '!border-l-0' : ''} !sticky top-0 !z-30 theme-table-header border-b`}
                >
                  <a
                    href={problem.url}
                    className="text-[color:var(--accent-hover)] hover:text-[color:var(--accent)] underline underline-offset-2 truncate"
                    target="_blank"
                    rel="noreferrer"
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
        <tbody className="divide-y divide-[color:var(--border-color)]">
          {students.map((student, i) => (
            <tr key={i} className="divide-x divide-[color:var(--border-color)]">
              <td className="theme-table-header sticky left-0 !z-20 border-r border-b border-[color:var(--border-color)]">
                <div
                  className={`relative flex flex-col divide-y ${tableBorderClass}`}
                >
                  <div className="truncate w-full px-4 py-1.5 h-[4rem] flex items-center">
                    {student.name}
                  </div>
                  <div
                    className={`truncate w-full px-4 py-1.5 ${tableCellSurfaceClass}`}
                  >
                    <TimeAgoLabel date={new Date(mostRecent[i])} />
                  </div>
                </div>
              </td>
              <>
                {data[i].map((_, j) => (
                  <td
                    key={j}
                    className={`relative ${j == 0 ? '!border-l-0' : ''} border-b`}
                  >
                    {data[i][j] && (
                      <>
                        {data[i][j]?.lastEdit === mostRecent[i] &&
                          highlight && (
                            <div className="absolute bg-[color:var(--accent)] inset-0" />
                          )}
                        <div
                          className={`relative z-10 ${tableCellSurfaceClass} flex flex-col divide-y ${tableBorderClass} ${
                            data[i][j]?.lastEdit === mostRecent[i] && highlight
                              ? 'border border-[color:var(--accent)] -m-[1px] opacity-90'
                              : (data[i][j]?.lastEdit ?? 0) >= fromTime
                                ? ''
                                : 'opacity-50'
                          }`}
                        >
                          <div className="truncate w-full px-4 py-1.5">
                            <a
                              className="underline text-[color:var(--accent-hover)] hover:text-[color:var(--accent)] mr-2"
                              href={`/${data[i][j].fileID.slice(1)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {data[i][j].verdict[0].toUpperCase() +
                                data[i][j].verdict.slice(1)}
                            </a>
                            <span>
                              {data[i][j].verdictType === 'wrong' && (
                                <FontAwesomeIcon
                                  icon={{ prefix: 'fas', iconName: 'xmark' }}
                                  className="inline w-4 h-4 text-red-500"
                                />
                              )}
                              {data[i][j].verdictType === 'accepted' && (
                                <FontAwesomeIcon
                                  icon={{ prefix: 'fas', iconName: 'check' }}
                                  className="inline w-4 h-4 text-green-500"
                                />
                              )}
                              {data[i][j].verdictType === 'error' && (
                                <FontAwesomeIcon
                                  icon={{
                                    prefix: 'fas',
                                    iconName: 'triangle-exclamation',
                                  }}
                                  className="inline w-4 h-4 text-yellow-500"
                                />
                              )}
                            </span>
                          </div>
                          <div
                            className={`truncate w-full px-4 py-1.5 ${tableCellAltSurfaceClass}`}
                          >
                            {data[i][j].codeSize} char
                          </div>
                          <div className="truncate w-full px-4 py-1.5">
                            <TimeAgoLabel
                              date={new Date(data[i][j].lastEdit)}
                            />
                          </div>
                        </div>
                      </>
                    )}
                    {!data[i][j] && (
                      <div className="absolute inset-0 bg-[color:var(--table-row-bg)] flex items-center w-full theme-text-muted px-4 py-3">
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
  const { userRole } = useUserContext();
  const [timeInd, setTimeInd] = useState(0);
  const [highlight, setHighlight] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [fromTime, setFromTime] = useState(
    () => Date.now() - timeInMs[timeInd]
  );

  const schoolsResource = useManagedSchools(userRole, refreshVersion);
  const schools = schoolsResource.data;
  const [schoolID, setSchoolID] = useScopedSelection(
    'teacher-schools',
    schools.map(school => school.id)
  );
  const groupsResource = useSchoolGroups(schoolID, { refreshVersion });
  const groupsList = groupsResource.data;
  const [groupID, setGroupID] = useScopedSelection(
    schoolID,
    groupsList.map(group => group.id)
  );
  const classesResource = useGroupClasses(groupID, refreshVersion);
  const studentsResource = useGroupStudents(groupID, refreshVersion);
  const groupClasses = classesResource.data;
  const students = studentsResource.data;
  const classes = groupClasses.map(groupClass => groupClass.id);
  const [classID, setClassID] = useScopedSelection(groupID, classes);

  const schoolNames = schools.map(school => school.name);
  const groupNames = groupsList.map(group => group.name);
  const schoolInd = Math.max(
    0,
    schools.findIndex(school => school.id === schoolID)
  );
  const groupInd = Math.max(
    0,
    groupsList.findIndex(group => group.id === groupID)
  );
  const classInd = Math.max(0, classes.indexOf(classID ?? ''));

  const studentIDs = students.map(student => student.id);
  const selectedClass = groupClasses.find(
    groupClass => groupClass.id === classID
  );
  const dashboardTasks = getDashboardTasks(selectedClass?.data.tasks ?? []);
  const problems = dashboardTasks;
  const summary = useClassTaskStatuses({
    schoolID,
    groupID,
    classID,
    studentIDs,
    tasks: dashboardTasks,
  });
  const studentRows = students.map(student => {
    const states = dashboardTasks.map(
      task => summary?.[student.id]?.[task.key]
    );
    return {
      student,
      states,
      data: states.map(state =>
        state?.status === 'ready' ? state.data : null
      ),
    };
  });
  const statusesSettled =
    summary !== null &&
    studentRows.every(row =>
      row.states.every(
        state => state?.status === 'ready' || state?.status === 'error'
      )
    );
  const visibleRows = statusesSettled
    ? studentRows.filter(row =>
        row.states.some(
          state =>
            state?.status === 'ready' &&
            state.data !== null &&
            state.data.lastEdit >= fromTime
        )
      )
    : [];

  const filteredStudents = visibleRows.map(row => row.student);
  const filteredData = visibleRows.map(row => row.data);

  const updateTimeInd = (index: number) => {
    setFromTime(Date.now() - timeInMs[index]);
    setTimeInd(index);
  };
  const handleRefresh = () => setRefreshVersion(version => version + 1);
  const classroomResources = [
    schoolsResource,
    groupsResource,
    classesResource,
    studentsResource,
  ];
  const isRefreshing = classroomResources.some(
    resource => resource.status === 'loading' || resource.isRefreshing
  );

  return (
    <div className="px-2">
      <div className="mx-auto max-w-7xl mt-4 space-y-4">
        <div className="md:hidden">
          <ControlDropdown
            schoolInd={schoolInd}
            groupInd={groupInd}
            classInd={classInd}
            timeInd={timeInd}
            classes={classes}
            schoolNames={schoolNames}
            groupNames={groupNames}
            highlight={highlight}
            setSchoolInd={index => setSchoolID(schools[index]?.id ?? null)}
            setGroupInd={index => setGroupID(groupsList[index]?.id ?? null)}
            setClassInd={index => setClassID(classes[index] ?? null)}
            setTimeInd={index => updateTimeInd(index)}
            toggleHighlight={() => setHighlight(val => !val)}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        </div>
        <div className="hidden md:block">
          <Controls
            schoolInd={schoolInd}
            groupInd={groupInd}
            classInd={classInd}
            timeInd={timeInd}
            classes={classes}
            schoolNames={schoolNames}
            groupNames={groupNames}
            highlight={highlight}
            setSchoolInd={index => setSchoolID(schools[index]?.id ?? null)}
            setGroupInd={index => setGroupID(groupsList[index]?.id ?? null)}
            setClassInd={index => setClassID(classes[index] ?? null)}
            setTimeInd={index => updateTimeInd(index)}
            toggleHighlight={() => setHighlight(val => !val)}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        </div>
        {classroomResources.some(resource => resource.status === 'error') && (
          <p className="text-sm text-[color:var(--danger)]">
            Classroom data could not be loaded.
          </p>
        )}
        <GroupData
          problems={problems}
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
    <>
      <PageTitle>Teacher dashboard</PageTitle>
      <WithTeacherLogin>
        <PageContent />
      </WithTeacherLogin>
    </>
  );
}
