import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { Menu } from '@headlessui/react';
import classNames from 'classnames';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { type ReactNode, useState } from 'react';
import { useAtomValue } from 'jotai';
import { statusDataAtom } from '../../atoms/workspaceUI';
import { useEditorContext } from '../../context/EditorContext';
import { useUserContext } from '../../context/UserContext';
import { useWorkspaceLaunchContext } from '../../context/WorkspaceLaunchContext';
import { getDashboardTasks } from '../../data/classroomMetadata';
import { useGroupClasses } from '../../hooks/useClassroomMetadata';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useStudentTaskStatuses } from '../../hooks/useStudentTaskStatuses';
import useUserPermission from '../../hooks/useUserPermission';
import { getTaskRef } from '../../scripts/getTaskRef';
import {
  getOutcomeDisplay,
  getSubmissionStatusDisplay,
  getTaskStatusDisplay,
} from '../TaskStatus/statusDisplay';
import { AnchoredMenuItems } from '../AnchoredMenuItems';

type LinkHref = React.ComponentProps<typeof Link>['href'];
type StatusDisplay = ReturnType<typeof getOutcomeDisplay>;

const StatusIcon = ({
  className,
  display,
}: {
  className: string;
  display: StatusDisplay;
}) => (
  <span className={`shrink-0 ${display.colorClass}`} title={display.label}>
    <display.Icon
      className={`${className} ${display.standaloneClass} ${
        display.spins ? 'animate-spin' : ''
      }`}
    />
  </span>
);

const useWorkspaceClassTasks = () => {
  const classContext = useWorkspaceLaunchContext();
  const { fileData } = useEditorContext();
  const { userData } = useUserContext();
  const showDesktopContext = useMediaQuery('(min-width: 1440px)');
  const groupID = classContext?.group ?? null;
  const classID = classContext?.class ?? null;
  const classesResource = useGroupClasses(
    showDesktopContext && groupID && classID ? groupID : null
  );
  const tasks = getDashboardTasks(
    classesResource.data.find(groupClass => groupClass.id === classID)?.data
      .tasks ?? []
  );
  const currentTaskIndex = fileData.problem
    ? tasks.findIndex(
        task =>
          task.platform === fileData.problem?.platform &&
          task.id === fileData.problem.id
      )
    : -1;
  const taskStatuses = useStudentTaskStatuses({
    schoolID: showDesktopContext ? (groupID?.split('~', 1)[0] ?? null) : null,
    groupID: showDesktopContext ? groupID : null,
    classID: showDesktopContext ? classID : null,
    userID: userData.id,
    targets: tasks,
  });
  const getTaskHref = (index: number) => {
    const task = tasks[index];
    const taskStatus = task && taskStatuses[task.key];
    if (!task || !classContext || taskStatus?.status !== 'ready')
      return undefined;

    return getTaskRef(
      taskStatus.data
        ? { id: taskStatus.data.fileID.slice(1) }
        : { platform: task.platform, problemID: task.id },
      classContext
    );
  };

  return { currentTaskIndex, getTaskHref, taskStatuses, tasks };
};

const WorkspaceTaskMenu = ({
  canNavigate,
  children,
  classTasks,
}: {
  canNavigate: boolean;
  children: ReactNode;
  classTasks: ReturnType<typeof useWorkspaceClassTasks>;
}) => {
  const router = useRouter();
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null
  );

  return (
    <Menu as="span" className="min-w-0">
      {({ open }) => (
        <>
          <Menu.Button
            ref={setReferenceElement}
            className={`pointer-events-auto block min-w-0 max-w-full rounded px-1.5 py-0.5 text-center outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus ${
              open ? 'bg-surface-hover' : ''
            }`}
          >
            {children}
          </Menu.Button>
          <AnchoredMenuItems
            anchor={referenceElement}
            className="w-72"
            menuClassName="max-h-96 origin-top overflow-y-auto overscroll-contain scroll-py-1"
            open={open}
            placement="bottom"
          >
            {classTasks.tasks.map((task, index) => {
              const isCurrent = index === classTasks.currentTaskIndex;
              const href = classTasks.getTaskHref(index);
              const disabled = isCurrent || !href || !canNavigate;
              const display = getTaskStatusDisplay(
                classTasks.taskStatuses[task.key] ?? { status: 'loading' }
              );

              return (
                <Menu.Item key={task.key} disabled={disabled}>
                  {({ active }) => (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => href && router.push(href)}
                      className={classNames('ui-menu-item py-1.5', {
                        'bg-surface-hover text-content': isCurrent,
                        'bg-surface-active text-content': active && !isCurrent,
                        'text-content-disabled': disabled && !isCurrent,
                      })}
                    >
                      <StatusIcon className="mr-2 h-4 w-4" display={display} />
                      <span
                        className={classNames(
                          'min-w-0 flex-1 truncate font-medium',
                          isCurrent && 'font-semibold'
                        )}
                      >
                        {task.title ?? task.source}
                      </span>
                      {task.title && (
                        <span className="ml-2 max-w-24 shrink-0 truncate text-[10px] text-content-muted">
                          {task.source}
                        </span>
                      )}
                    </button>
                  )}
                </Menu.Item>
              );
            })}
          </AnchoredMenuItems>
        </>
      )}
    </Menu>
  );
};

const TaskNavigationButton = ({
  direction,
  href,
}: {
  direction: 'Previous' | 'Next';
  href?: LinkHref;
}) => {
  const Icon = direction === 'Previous' ? ChevronLeftIcon : ChevronRightIcon;
  const className =
    'workspace-toolbar-nav-button pointer-events-auto justify-center px-0 disabled:cursor-not-allowed disabled:border-transparent disabled:text-content-disabled disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-content-disabled';
  const title = href
    ? `${direction} task`
    : `No ${direction.toLowerCase()} task`;

  return href ? (
    <Link href={href} title={title} className={className}>
      <Icon className="h-7 w-7" />
    </Link>
  ) : (
    <button type="button" title={title} className={className} disabled>
      <Icon className="h-7 w-7" />
    </button>
  );
};

export const WorkspaceTitleNavigation = () => {
  const classTasks = useWorkspaceClassTasks();
  const { fileData } = useEditorContext();
  const permission = useUserPermission();
  const statusData = useAtomValue(statusDataAtom);
  const currentTask = classTasks.tasks[classTasks.currentTaskIndex];
  const hasClassTask = currentTask !== undefined;
  const canNavigateTasks = hasClassTask && permission === 'OWNER';
  const statusDisplay = statusData
    ? getSubmissionStatusDisplay(statusData)
    : getOutcomeDisplay('untried');
  const taskLabel = (
    <span className="flex min-w-0 items-center justify-center gap-2.5">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium leading-tight text-content-secondary">
          {currentTask
            ? (currentTask.title ?? currentTask.source)
            : fileData.settings.workspaceName}
        </span>
        {currentTask && (
          <span className="block truncate text-[10px] leading-tight text-content-muted">
            {currentTask.source}
          </span>
        )}
      </span>
      {hasClassTask && (
        <StatusIcon className="h-5 w-5" display={statusDisplay} />
      )}
    </span>
  );

  return (
    <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 grid-cols-[2.5rem_auto_2.5rem] items-center min-[1440px]:grid">
      {canNavigateTasks ? (
        <TaskNavigationButton
          direction="Previous"
          href={classTasks.getTaskHref(classTasks.currentTaskIndex - 1)}
        />
      ) : (
        <span />
      )}
      <span className="min-w-0 max-w-[14rem] px-2 min-[1600px]:max-w-[20rem] min-[1920px]:max-w-[28rem]">
        {hasClassTask ? (
          <WorkspaceTaskMenu
            canNavigate={canNavigateTasks}
            classTasks={classTasks}
          >
            {taskLabel}
          </WorkspaceTaskMenu>
        ) : (
          <span
            className="min-w-0 text-center"
            title={fileData.settings.workspaceName ?? undefined}
          >
            {taskLabel}
          </span>
        )}
      </span>
      {canNavigateTasks ? (
        <TaskNavigationButton
          direction="Next"
          href={classTasks.getTaskHref(classTasks.currentTaskIndex + 1)}
        />
      ) : (
        <span />
      )}
    </div>
  );
};
