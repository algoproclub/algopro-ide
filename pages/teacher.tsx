import Dropdown from '../src/components/Dropdown';
import React, { useState } from 'react';
import { Disclosure } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import Checkbox from '../src/components/Checkbox';
import WithTeacherLogin from '../src/components/WithTeacherLogin';
import { type UserRole, useUserContext } from '../src/context/UserContext';
import RefreshButton from '../src/components/RefreshButton';
import PageTitle from '../src/components/PageTitle';
import TeacherDashboardTable from '../src/components/TeacherDashboard/TeacherDashboardTable';
import { getDashboardTasks } from '../src/data/classroomMetadata';
import {
  useGroupClasses,
  useGroupStudents,
  useManagedSchools,
  useSchoolGroups,
} from '../src/hooks/useClassroomMetadata';
import { useClassTaskStatuses } from '../src/hooks/useStudentTaskStatuses';
import { useScopedSelection } from '../src/hooks/useScopedSelection';

const times = ['1 hour', '3 hours', '1 day', '7 days', 'All'];
const timeInMs = [
  1000 * 60 * 60,
  1000 * 60 * 60 * 3,
  1000 * 60 * 60 * 24,
  1000 * 60 * 60 * 24 * 7,
  Infinity,
];

type ControlsProps = {
  schoolID: string | null;
  groupID: string | null;
  classID: string | null;
  timeOption: number;
  highlight: boolean;
  schoolsLoading: boolean;
  groupsLoading: boolean;
  classesLoading: boolean;
  schoolOptions: Array<{ label: string; value: string }>;
  groupOptions: Array<{ label: string; value: string }>;
  classes: string[];
  setSchoolID: (_: string) => void;
  setGroupID: (_: string) => void;
  setClassID: (_: string) => void;
  setTimeOption: (_: number) => void;
  toggleHighlight: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
};

type ControlsFieldsProps = Omit<ControlsProps, 'onRefresh'> & {
  layout: 'mobile' | 'desktop';
  onRefresh?: () => void;
};

const ControlsFields = ({
  schoolID,
  groupID,
  classID,
  timeOption,
  highlight,
  schoolsLoading,
  groupsLoading,
  classesLoading,
  schoolOptions,
  groupOptions,
  classes,
  setSchoolID,
  setGroupID,
  setClassID,
  setTimeOption,
  toggleHighlight,
  layout,
  onRefresh,
  isRefreshing,
}: ControlsFieldsProps) => {
  const isDesktop = layout === 'desktop';

  return (
    <div className={isDesktop ? 'space-y-2' : 'space-y-3'}>
      <div
        className={isDesktop ? 'flex w-full items-end space-x-2' : 'space-y-4'}
      >
        <Dropdown
          items={schoolOptions}
          label="School"
          placeholder="Select school…"
          disabledPlaceholder="Loading schools…"
          selected={schoolID}
          setSelected={setSchoolID}
          disabled={schoolsLoading}
        />
        <Dropdown
          items={groupOptions}
          label="Group"
          disabledPlaceholder={
            groupsLoading ? 'Loading groups…' : 'Select a school first'
          }
          placeholder="Select group…"
          selected={groupID}
          setSelected={setGroupID}
          disabled={!schoolID || groupsLoading}
        />
        <Dropdown
          items={classes}
          label="Class"
          disabledPlaceholder={
            classesLoading ? 'Loading classes…' : 'Select a group first'
          }
          placeholder="Select class…"
          emptyLabel="No classes in this group yet"
          selected={classID}
          setSelected={setClassID}
          disabled={!groupID || classesLoading}
        />
        <Dropdown
          items={times.map((label, index) => ({ label, value: index }))}
          label="Last edit"
          selected={timeOption}
          setSelected={setTimeOption}
        />
        {isDesktop && onRefresh && (
          <RefreshButton
            title="Refresh groups, classes and students"
            onClick={onRefresh}
            isLoading={isRefreshing}
          />
        )}
      </div>
      <Checkbox
        checked={highlight}
        toggleChecked={toggleHighlight}
        label="Highlight last edited file"
      />
    </div>
  );
};

const Controls = (props: ControlsProps) => {
  return (
    <>
      <div className="md:hidden">
        <Disclosure>
          {({ open }) => (
            <div className="space-y-2">
              <div className="flex w-full items-stretch gap-2">
                <Disclosure.Button className="theme-button-secondary flex w-full items-center justify-center rounded-md border px-4 py-2 text-sm">
                  Filter
                  <ChevronDownIcon
                    className={`ml-2 inline h-4 w-4 transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
                  />
                </Disclosure.Button>
                <RefreshButton
                  title="Refresh groups, classes and students"
                  onClick={props.onRefresh}
                  isLoading={props.isRefreshing}
                />
              </div>
              <Disclosure.Panel className="theme-border theme-surface relative space-y-3 rounded-md border p-3">
                <ControlsFields layout="mobile" {...props} />
              </Disclosure.Panel>
            </div>
          )}
        </Disclosure>
      </div>
      <div className="theme-border theme-surface-raised hidden w-full space-y-2 rounded-lg border p-3 md:block">
        <ControlsFields layout="desktop" {...props} />
      </div>
    </>
  );
};

const useTeacherClassroom = (userRole: UserRole | null) => {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [schoolRetryVersion, setSchoolRetryVersion] = useState(0);
  const schoolsResource = useManagedSchools(userRole, schoolRetryVersion);
  const schools = schoolsResource.data;
  const [schoolID, setSchoolID] = useScopedSelection(
    'teacher-schools',
    schools.map(school => school.id)
  );

  const groupsResource = useSchoolGroups(schoolID, { refreshVersion });
  const groups = groupsResource.data;
  const [groupID, setGroupID] = useScopedSelection(
    schoolID,
    groups.map(group => group.id)
  );

  const classesResource = useGroupClasses(groupID, refreshVersion);
  const studentsResource = useGroupStudents(groupID, refreshVersion);
  const classIDs = classesResource.data.map(groupClass => groupClass.id);
  const [classID, setClassID] = useScopedSelection(
    groupID,
    classIDs,
    classIDs[0]
  );
  const selectedClass = classesResource.data.find(
    groupClass => groupClass.id === classID
  );
  const tasks = getDashboardTasks(selectedClass?.data.tasks ?? []);
  const activeResources = [
    schoolsResource,
    ...(schoolID ? [groupsResource] : []),
    ...(groupID ? [classesResource, studentsResource] : []),
  ];

  return {
    schools,
    schoolID,
    schoolStatus: schoolsResource.status,
    groups,
    groupID,
    groupStatus: groupsResource.status,
    classes: classIDs,
    classID,
    classStatus: classesResource.status,
    students: studentsResource.data,
    studentStatus: studentsResource.status,
    tasks,
    isLoading: activeResources.some(resource => resource.status === 'loading'),
    isRefreshing: activeResources.some(resource => resource.isRefreshing),
    error: activeResources.some(resource => resource.status === 'error'),
    setSchoolID,
    setGroupID,
    setClassID,
    refresh: () => {
      if (schoolsResource.status === 'error')
        setSchoolRetryVersion(version => version + 1);
      setRefreshVersion(version => version + 1);
    },
  };
};

const PageContent = () => {
  const { userRole } = useUserContext();
  const [timeOption, setTimeOption] = useState(0);
  const [highlight, setHighlight] = useState(false);
  const {
    schools,
    schoolID,
    groupID,
    classID,
    groups,
    classes,
    students,
    tasks,
    schoolStatus,
    groupStatus,
    classStatus,
    studentStatus,
    isLoading,
    isRefreshing,
    error,
    setSchoolID,
    setGroupID,
    setClassID,
    refresh,
  } = useTeacherClassroom(userRole);

  const schoolOptions = schools.map(school => ({
    label: school.name,
    value: school.id,
  }));
  const groupOptions = groups.map(group => ({
    label: group.name,
    value: group.id,
  }));
  const groupName =
    groups.find(group => group.id === groupID)?.name ?? groupID ?? '';
  const summary = useClassTaskStatuses({
    schoolID,
    groupID,
    classID,
    studentIDs: students.map(student => student.id),
    tasks,
  });

  const selectionMessage = !schoolID
    ? schoolStatus === 'loading'
      ? 'Loading schools…'
      : schoolStatus === 'error'
        ? 'Schools could not be loaded. Try refreshing them.'
        : 'Select a school to view student progress.'
    : !groupID
      ? groupStatus === 'loading'
        ? 'Loading groups…'
        : groupStatus === 'error'
          ? 'Groups could not be loaded. Try refreshing them.'
          : groups.length
            ? 'Select a group to view student progress.'
            : 'This school has no groups.'
      : !classID
        ? classStatus === 'loading'
          ? 'Loading classes…'
          : classStatus === 'error'
            ? 'Classes could not be loaded. Try refreshing them.'
            : 'This group has no classes.'
        : null;

  return (
    <div className="theme-page px-3">
      <div className="mx-auto mt-3 max-w-7xl space-y-3">
        <Controls
          schoolID={schoolID}
          groupID={groupID}
          classID={classID}
          timeOption={timeOption}
          classes={classes}
          schoolOptions={schoolOptions}
          groupOptions={groupOptions}
          highlight={highlight}
          schoolsLoading={schoolStatus === 'loading'}
          groupsLoading={groupStatus === 'loading'}
          classesLoading={classStatus === 'loading'}
          setSchoolID={setSchoolID}
          setGroupID={setGroupID}
          setClassID={setClassID}
          setTimeOption={setTimeOption}
          toggleHighlight={() => setHighlight(val => !val)}
          onRefresh={refresh}
          isRefreshing={isLoading || isRefreshing}
        />
        {error && !selectionMessage && (
          <p className="rounded-lg border border-[color:var(--danger)] px-4 py-3 text-sm text-[color:var(--danger)]">
            Some classroom data could not be loaded. The last available data is
            shown; try refreshing it.
          </p>
        )}
        {selectionMessage || !classID ? (
          <section className="theme-border theme-surface theme-text-muted rounded-lg border px-4 py-12 text-center text-sm">
            {selectionMessage}
          </section>
        ) : (
          <TeacherDashboardTable
            classID={classID}
            groupName={groupName}
            tasks={tasks}
            students={students}
            summary={summary}
            timeWindow={timeInMs[timeOption]}
            highlightMostRecent={highlight}
            isLoading={isLoading}
            errorMessage={
              studentStatus === 'error' && students.length === 0
                ? 'Students could not be loaded. Try refreshing them.'
                : undefined
            }
            emptyStudentMessage="No students have edited this class during the selected period."
          />
        )}
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
