import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
} from '@heroicons/react/20/solid';
import React from 'react';
import { isUserOnline, useOnlineUsers } from '../../hooks/useOnlineUsers';
import Link from 'next/link';
import { PlatformSubmitButton } from '../JudgeInterface/PlatformSubmitButton';
import { useAtom } from 'jotai';
import { problemAtom, statusDataAtom } from '../../atoms/workspaceUI';
import { useEditorContext } from '../../context/EditorContext';
import {
  mainMonacoEditorAtom,
  mainCodemirrorEditorAtom,
} from '../../atoms/workspace';
import { yUndoManagerKeymap } from 'y-codemirror.next';
import { SettingsMenu } from './SettingsMenu';
import { EditorNavigationMenu } from './EditorNavigationMenu';
import Logo from '../Logo';
import Tooltip from '../Tooltip';
import { WorkspaceTitleNavigation } from './WorkspaceTitleNavigation';

export interface DesktopNavBarProps {
  fileMenu: JSX.Element;
  runButton: JSX.Element;
  showViewOnly: boolean;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  showSidebarButton: boolean;
  setIsProfileSettingsOpen: (isOpen: boolean) => void;
}

type SimpleButtonProps = {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
} & React.ComponentPropsWithoutRef<'button'>;

const SimpleButton = ({
  Icon,
  className,
  disabled,
  onClick,
  ...buttonProps
}: SimpleButtonProps): JSX.Element => {
  return (
    <button
      disabled={disabled}
      className={`workspace-toolbar-button relative px-2 text-sm font-medium ${className ?? ''}`}
      onClick={onClick}
      {...buttonProps}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
};

const ToolbarSeparator = (): JSX.Element => (
  <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-line" />
);

export const NavBar = (props: DesktopNavBarProps): JSX.Element => {
  const onlineUsers = useOnlineUsers();
  const onlineUserCount = onlineUsers?.filter(isUserOnline).length;

  const { fileData } = useEditorContext();
  const [problem] = useAtom(problemAtom);
  const [statusData, setStatusData] = useAtom(statusDataAtom);

  const [mainMonacoEditor] = useAtom(mainMonacoEditorAtom);
  const [mainCodemirrorEditor] = useAtom(mainCodemirrorEditorAtom);

  const handleUndo = () => {
    if (mainCodemirrorEditor) {
      // This is completely ridiculous, but there is no way to access undo/redo directly
      const undoAction = yUndoManagerKeymap.find(m => m.key == 'Mod-z')?.run;
      undoAction?.(mainCodemirrorEditor);
    } else if (mainMonacoEditor) {
      mainMonacoEditor.trigger('undo', 'undo', null);
    }
  };

  const handleRedo = () => {
    if (mainCodemirrorEditor) {
      // This is completely ridiculous, but there is no way to access undo/redo directly
      const redoAction = yUndoManagerKeymap.find(m => m.key == 'Mod-y')?.run;
      redoAction?.(mainCodemirrorEditor);
    } else if (mainMonacoEditor) {
      mainMonacoEditor.trigger('redo', 'redo', null);
    }
  };

  const secondaryIconClass = '-ml-0.5 mr-1.5 h-4 w-4 text-content-muted';

  return (
    <div className="relative flex min-h-[2.25rem] items-center gap-0.5 overflow-x-auto border-b border-line bg-panel-muted px-0.5 py-1 text-content shadow-sm">
      <div className="flex w-full items-center gap-0.5 lg:w-auto">
        <Tooltip label="Home">
          <Link
            href="/"
            aria-label="Home"
            className="workspace-toolbar-nav-button relative"
          >
            <Logo className="h-5 w-5 object-contain" alt="Home" />
          </Link>
        </Tooltip>
        <ToolbarSeparator />
        <EditorNavigationMenu />
        {props.fileMenu}
        <ToolbarSeparator />
        <div
          role="group"
          aria-label="Edit history"
          className="inline-flex rounded-md shadow-sm"
        >
          <Tooltip label="Undo">
            <SimpleButton
              className="rounded-r-none shadow-none focus-visible:z-10"
              onClick={handleUndo}
              Icon={ArrowUturnLeftIcon}
              disabled={props.showViewOnly}
            />
          </Tooltip>
          <Tooltip label="Redo">
            <SimpleButton
              className="-ml-px rounded-l-none shadow-none focus-visible:z-10"
              onClick={handleRedo}
              Icon={ArrowUturnRightIcon}
              disabled={props.showViewOnly}
            />
          </Tooltip>
        </div>
        <ToolbarSeparator />
      </div>
      {props.runButton}
      {problem?.submittable && problem.id === fileData.problem?.id && (
        <PlatformSubmitButton
          platform={problem?.platform}
          statusData={statusData}
          setStatusData={setStatusData}
        />
      )}
      <div className="flex items-center">
        {props.showViewOnly && (
          <span className="hidden whitespace-nowrap px-2.5 py-1 text-xs font-medium text-content-muted sm:inline">
            View Only
          </span>
        )}
      </div>
      <div className="flex-1" />
      <WorkspaceTitleNavigation />
      {props.showSidebarButton && (
        <div>
          <button
            type="button"
            className="workspace-toolbar-nav-button relative whitespace-nowrap"
            onClick={() => props.onToggleSidebar()}
          >
            {props.isSidebarOpen ? (
              <ChevronRightIcon
                className={secondaryIconClass}
                aria-hidden="true"
              />
            ) : (
              <ChevronLeftIcon
                className={secondaryIconClass}
                aria-hidden="true"
              />
            )}
            {onlineUserCount} User{onlineUserCount === 1 ? '' : 's'} Online
          </button>
        </div>
      )}
      <div className="relative">
        <SettingsMenu
          setIsProfileSettingsOpen={props.setIsProfileSettingsOpen}
        />
      </div>
    </div>
  );
};
