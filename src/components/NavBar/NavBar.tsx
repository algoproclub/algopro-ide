import {
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
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
import classNames from 'classnames';
import {
  mainMonacoEditorAtom,
  mainCodemirrorEditorAtom,
} from '../../atoms/workspace';
import { yUndoManagerKeymap } from 'y-codemirror.next';
import { SettingsMenu } from './SettingsMenu';
import { EditorNavigationMenu } from './EditorNavigationMenu';

export interface DesktopNavBarProps {
  fileMenu: JSX.Element;
  runButton: JSX.Element;
  showViewOnly: boolean;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  showSidebarButton: boolean;
  setIsProfileSettingsOpen: (isOpen: boolean) => void;
}

const SimpleButton = ({
  Icon,
  disabled,
  onClick,
}: {
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  disabled: boolean;
  onClick: () => void;
}): JSX.Element => {
  const enabledButtonClass =
    'text-[color:var(--text-primary)] hover:bg-[var(--hover-bg)] focus:bg-[var(--hover-bg)] focus:outline-none';
  const disabledButtonClass =
    'text-[color:var(--text-secondary)] cursor-not-allowed';

  return (
    <button
      disabled={disabled}
      className={classNames(
        'relative inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium',
        !disabled && enabledButtonClass,
        disabled && disabledButtonClass
      )}
      onClick={onClick}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
};

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

  const navButtonClass =
    'relative inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium text-[color:var(--text-primary)] hover:bg-[var(--hover-bg)] focus:bg-[var(--hover-bg)] focus:outline-none';
  const secondaryIconClass =
    '-ml-1 mr-2 h-5 w-5 text-[color:var(--text-secondary)]';

  return (
    <div className="flex items-center overflow-x-auto border-b border-[var(--border-color)] bg-[var(--panel-bg-alt)] text-[color:var(--text-primary)]">
      <div className="flex w-full lg:w-auto items-center divide-x divide-[var(--border-color)]">
        <Link href="/" className={navButtonClass}>
          <HomeIcon className="h-5 w-5" />
        </Link>
        <EditorNavigationMenu />
        {props.fileMenu}
        <SimpleButton
          onClick={handleUndo}
          Icon={ArrowUturnLeftIcon}
          disabled={props.showViewOnly}
        />
        <SimpleButton
          onClick={handleRedo}
          Icon={ArrowUturnRightIcon}
          disabled={props.showViewOnly}
        />
      </div>
      {props.runButton}
      {problem?.submittable && problem.id === fileData.problem?.id && (
        <PlatformSubmitButton
          platform={problem?.platform}
          statusData={statusData}
          setStatusData={setStatusData}
        />
      )}
      <div className="flex items-center divide-x divide-[var(--border-color)]">
        {props.showViewOnly && (
          <span className="px-4 py-2 text-[color:var(--text-secondary)] text-sm font-medium whitespace-nowrap hidden sm:inline">
            View Only
          </span>
        )}
      </div>
      <div className="flex-1" />
      {props.showSidebarButton && (
        <div>
          <button
            type="button"
            className={`${navButtonClass} whitespace-nowrap`}
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
