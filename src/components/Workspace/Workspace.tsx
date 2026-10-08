import {
  EllipsisHorizontalIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/20/solid';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  useGroupRef,
  type Layout,
  type LayoutStorage,
} from 'react-resizable-panels';
import {
  inputCodemirrorEditorAtom,
  inputMonacoEditorAtom,
} from '../../atoms/workspace';
import {
  hasSolutionsAtom,
  inputTabAtom,
  languageAtom,
  mobileActiveTabAtom,
  problemAtom,
  showSidebarAtom,
  solvedAtom,
  statusDataAtom,
  statusDataHistoryAtom,
  translationsAtom,
} from '../../atoms/workspaceUI';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Chat } from '../Chat';
import { CodeInterface } from '../CodeInterface/CodeInterface';
import RealtimeEditor from '../RealtimeEditor/RealtimeEditor';
import { Output } from '../Output';
import { TabBar } from '../TabBar';
import { UserList } from '../UserList/UserList';
import Samples, { getSampleTabId } from '../JudgeInterface/Samples';
import Hints from '../JudgeInterface/Hints';
import useJudgeResults from '../../hooks/useJudgeResults';
import USACOJudgeInterface from '../JudgeInterface/USACOJudgeInterface';
import GenericJudgeInterface from '../JudgeInterface/GenericJudgeInterface';
import { useEditorContext } from '../../context/EditorContext';
import useUserPermission from '../../hooks/useUserPermission';
import { useUserContext } from '../../context/UserContext';
import { EditorHandle, isMonacoEditorHandle } from '../editor/editor-types';
import { Translation } from '../../types/problem';
import Solutions from '../JudgeInterface/Solutions';

const defaultDesktopPanelSizes = { code: 60, sidebar: 10, ioCollapsed: false };
const defaultInputOutputLayout = { input: 67, output: 33 };
const minimumInputOutputSize = 10;
const minimumSidebarSize = 8;
const desktopLayoutStorageKey = 'algopro-workspace-columns';
const inputOutputLayoutStorageKey = 'algopro-workspace-input-output';

type DesktopPanelSizes = typeof defaultDesktopPanelSizes;

const layoutStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Failed to read workspace layout.', error);
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Failed to save workspace layout.', error);
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to reset workspace layout.', error);
    }
  },
};

const inputOutputLayoutStorage: LayoutStorage = {
  getItem: () => layoutStorage.getItem(inputOutputLayoutStorageKey),
  setItem: (_key, value) =>
    layoutStorage.setItem(inputOutputLayoutStorageKey, value),
};

function getDesktopLayout(
  sizes: DesktopPanelSizes,
  showSidebar: boolean
): Layout {
  if (!showSidebar) {
    const code = sizes.ioCollapsed ? 100 : sizes.code;
    return { code, io: 100 - code };
  }

  const minimumIOSize = sizes.ioCollapsed ? 0 : minimumInputOutputSize;
  const sidebar = Math.max(
    minimumSidebarSize,
    Math.min(sizes.sidebar, 100 - sizes.code - minimumIOSize)
  );
  const code = Math.min(sizes.code, 100 - sidebar - minimumIOSize);

  return { code, io: 100 - code - sidebar, sidebar };
}

function PanelResizeHandle({
  orientation,
}: {
  orientation: 'horizontal' | 'vertical';
}): JSX.Element {
  const isTouchDevice = useMediaQuery('(any-pointer: coarse)');
  const GripIcon =
    orientation === 'horizontal'
      ? EllipsisVerticalIcon
      : EllipsisHorizontalIcon;

  return (
    <Separator
      className={classNames(
        'items-center justify-center bg-gutter transition focus:outline-none',
        orientation === 'horizontal'
          ? isTouchDevice
            ? 'w-0.5 cursor-col-resize'
            : 'w-px cursor-col-resize'
          : isTouchDevice
            ? 'h-0.5 cursor-row-resize'
            : 'h-px cursor-row-resize',
        'hover:bg-gutter-hover focus:bg-gutter-hover',
        'relative z-10 flex',
        isTouchDevice &&
          classNames(
            "workspace-touch-resize-handle before:absolute before:content-['']",
            orientation === 'horizontal'
              ? 'before:-inset-x-2 before:inset-y-0'
              : 'before:-inset-y-2 before:inset-x-0'
          )
      )}
    >
      <span
        className={classNames(
          'pointer-events-none flex items-center justify-center text-content-secondary',
          isTouchDevice
            ? classNames(
                'workspace-touch-resize-grip rounded-full bg-gutter-hover transition-[width,height]',
                orientation === 'horizontal'
                  ? 'workspace-touch-column-grip h-8 w-3.5'
                  : 'workspace-touch-row-grip h-3.5 w-8'
              )
            : 'h-5 w-5'
        )}
      >
        <GripIcon className={isTouchDevice ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
      </span>
    </Separator>
  );
}

export function getHints(
  translations: Record<string, Translation>,
  language: string
) {
  const firstNonEmpty = <T,>(...arrays: T[][]): T[] =>
    arrays.find(arr => Array.isArray(arr) && arr.length > 0) || [];

  return firstNonEmpty(
    translations[language]?.hints,
    translations['en']?.hints,
    translations['hu']?.hints,
    []
  );
}

function WorkspaceInputPanel(): JSX.Element {
  const { fileData } = useEditorContext();
  const { lightMode, fontSize } = useUserContext().userData;
  const permission = useUserPermission();
  const readOnly = !(permission === 'OWNER' || permission === 'READ_WRITE');
  const setInputEditor = useSetAtom(inputMonacoEditorAtom);
  const setCodemirrorInputEditor = useSetAtom(inputCodemirrorEditorAtom);
  const [inputEditorHandle, setInputEditorHandle] =
    useState<EditorHandle | null>(null);

  useEffect(() => {
    if (!inputEditorHandle) return;

    if (isMonacoEditorHandle(inputEditorHandle)) {
      setInputEditor(inputEditorHandle.raw);
      return () => setInputEditor(null);
    }

    setCodemirrorInputEditor(inputEditorHandle.raw);

    return () => {
      setCodemirrorInputEditor(null);
    };
  }, [inputEditorHandle, setCodemirrorInputEditor, setInputEditor]);

  return (
    <div className="h-full overflow-hidden">
      <RealtimeEditor
        theme={lightMode ? 'light' : 'dark'}
        language="plaintext"
        saveViewState={false}
        path="input"
        dataTestId="input-editor"
        editorOptions={{
          insertSpaces: false,
          readOnly,
          fontSize,
        }}
        onReady={handle => {
          setInputEditorHandle(handle);
        }}
        defaultValue="1 2 3"
        yjsDocumentId={`${fileData.id}.input`}
      />
    </div>
  );
}

function TaskOverviewPanel({
  handleRunCode,
}: {
  handleRunCode: () => void;
}): JSX.Element {
  const problem = useAtomValue(problemAtom);
  const translations = useAtomValue(translationsAtom);
  const [language, setLanguage] = useAtom(languageAtom);
  const [statusData, setStatusData] = useAtom(statusDataAtom);

  return (
    <div className="h-full overflow-hidden">
      {problem &&
        Object.keys(translations).length > 0 &&
        (problem.platform !== 'usaco' ? (
          <GenericJudgeInterface
            problem={problem}
            translations={translations}
            language={language}
            setLanguage={setLanguage}
          />
        ) : (
          <USACOJudgeInterface
            problem={problem}
            statusData={statusData}
            setStatusData={setStatusData}
            handleRunCode={handleRunCode}
          />
        ))}
    </div>
  );
}

function InputPane({
  handleRunCode,
}: {
  handleRunCode: () => void;
}): JSX.Element {
  const { fileData } = useEditorContext();
  const [inputTab, setInputTab] = useAtom(inputTabAtom);
  const loadedProblem = useAtomValue(problemAtom);
  const translations = useAtomValue(translationsAtom);
  const language = useAtomValue(languageAtom);
  const solved = useAtomValue(solvedAtom);
  const problem =
    loadedProblem?.id === fileData.problem?.id ? loadedProblem : undefined;
  const hints = problem ? getHints(translations, language) : [];
  const hasSolutions = useAtomValue(hasSolutionsAtom);
  const showSolutions =
    solved && (hasSolutions || problem?.platform === 'planets');

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <TabBar
        selectedId={inputTab}
        onSelectionChange={setInputTab}
        ariaLabel="Workspace input"
        panelsClassName="min-h-0 min-w-0 flex-1 overflow-hidden bg-canvas text-content"
      >
        <TabBar.Item id="input" label="Input" unmount={false}>
          <WorkspaceInputPanel />
        </TabBar.Item>
        {problem && (
          <TabBar.Item id="judge" label="Task Overview">
            <TaskOverviewPanel handleRunCode={handleRunCode} />
          </TabBar.Item>
        )}
        {hints.length > 0 && (
          <TabBar.Item id="hints" label="Hints">
            <Hints hints={hints} />
          </TabBar.Item>
        )}
        {problem?.samples.map((_, index) => {
          const tabId = getSampleTabId(problem.samples.length, index);

          return (
            <TabBar.Item key={tabId} id={tabId} label={tabId}>
              <Samples
                samples={problem.samples}
                inputTab={tabId}
                handleRunCode={handleRunCode}
              />
            </TabBar.Item>
          );
        })}
        {problem && showSolutions && (
          <TabBar.Item id="solutions" label="Solutions">
            <div className="h-full overflow-hidden">
              <div className="relative h-full p-4 pb-0">
                <Solutions problem={problem} />
              </div>
            </div>
          </TabBar.Item>
        )}
      </TabBar>
    </div>
  );
}

function OutputPane(): JSX.Element {
  const { fileData } = useEditorContext();
  const inputTab = useAtomValue(inputTabAtom);
  const loadedProblem = useAtomValue(problemAtom);
  const { getResultForTab } = useJudgeResults();
  const statusData = useAtomValue(statusDataAtom);
  const statusDataHistory = useAtomValue(statusDataHistoryAtom);
  const sampleCount =
    loadedProblem &&
    fileData.problem &&
    loadedProblem.platform === fileData.problem.platform &&
    loadedProblem.id === fileData.problem.id
      ? loadedProblem.samples.length
      : 0;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <Output
        result={getResultForTab(inputTab, sampleCount)}
        statusData={statusData}
        statusDataHistory={statusDataHistory}
      />
    </div>
  );
}

function SidebarPane(): JSX.Element {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-auto bg-canvas text-content">
      <UserList className="max-h-64 max-w-full lg:mt-3" />
      <Chat className="min-h-0 flex-1" />
    </div>
  );
}

function InputOutputPane({
  handleRunCode,
  layoutResetKey,
}: {
  handleRunCode: () => void;
  layoutResetKey: number;
}): JSX.Element {
  const groupRef = useGroupRef();
  const previousLayoutResetKeyRef = useRef(layoutResetKey);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'workspace-io-rows',
    storage: inputOutputLayoutStorage,
    onlySaveAfterUserInteractions: true,
  });

  useEffect(() => {
    if (layoutResetKey === previousLayoutResetKeyRef.current) return;
    previousLayoutResetKeyRef.current = layoutResetKey;

    layoutStorage.removeItem(inputOutputLayoutStorageKey);
    groupRef.current?.setLayout(defaultInputOutputLayout);
  }, [groupRef, layoutResetKey]);

  return (
    <Group
      id="workspace-io-rows"
      groupRef={groupRef}
      orientation="vertical"
      defaultLayout={defaultLayout ?? defaultInputOutputLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <Panel id="input" minSize="10%" className="h-full min-h-0">
        <InputPane handleRunCode={handleRunCode} />
      </Panel>
      <PanelResizeHandle orientation="vertical" />
      <Panel id="output" minSize="10%" className="h-full min-h-0">
        <OutputPane />
      </Panel>
    </Group>
  );
}

function WorkspacePanels({
  handleRunCode,
  layoutResetKey,
}: {
  handleRunCode: () => void;
  layoutResetKey: number;
}): JSX.Element {
  const isDesktop = useMediaQuery('(min-width: 1024px)', true);
  const mobileActiveTab = useAtomValue(mobileActiveTabAtom);
  const showSidebar = useAtomValue(showSidebarAtom);
  const groupRef = useGroupRef();
  const desktopPanelSizesRef = useRef<DesktopPanelSizes>({
    ...defaultDesktopPanelSizes,
  });
  const desktopLayoutLoadedRef = useRef(false);
  const previousLayoutResetKeyRef = useRef(layoutResetKey);

  const renderSidebar = !isDesktop || showSidebar;

  useEffect(() => {
    if (!isDesktop || desktopLayoutLoadedRef.current) return;

    try {
      const stored = layoutStorage.getItem(desktopLayoutStorageKey);
      const sizes = stored
        ? (JSON.parse(stored) as Partial<DesktopPanelSizes>)
        : null;

      if (
        typeof sizes?.code === 'number' &&
        Number.isFinite(sizes.code) &&
        typeof sizes.sidebar === 'number' &&
        Number.isFinite(sizes.sidebar)
      ) {
        desktopPanelSizesRef.current = {
          code: sizes.code,
          sidebar: sizes.sidebar,
          ioCollapsed: sizes.ioCollapsed === true,
        };
      }
    } catch {
      // Use the default layout when storage is unavailable or invalid.
    }
    desktopLayoutLoadedRef.current = true;

    groupRef.current?.setLayout(
      getDesktopLayout(desktopPanelSizesRef.current, showSidebar)
    );
  }, [groupRef, isDesktop, showSidebar]);

  useEffect(() => {
    if (layoutResetKey === previousLayoutResetKeyRef.current) return;
    previousLayoutResetKeyRef.current = layoutResetKey;

    layoutStorage.removeItem(desktopLayoutStorageKey);
    desktopPanelSizesRef.current = { ...defaultDesktopPanelSizes };
    if (isDesktop) {
      groupRef.current?.setLayout(
        getDesktopLayout(desktopPanelSizesRef.current, showSidebar)
      );
    }
  }, [groupRef, isDesktop, layoutResetKey, showSidebar]);

  const handleDesktopLayoutChanged = (
    layout: Layout,
    { isUserInteraction }: { isUserInteraction: boolean }
  ) => {
    if (!isDesktop) return;

    if (!isUserInteraction) {
      const expected = getDesktopLayout(
        desktopPanelSizesRef.current,
        showSidebar
      );
      if (
        Object.entries(expected).some(
          ([id, size]) => Math.abs((layout[id] ?? -100) - size) > 0.01
        )
      ) {
        groupRef.current?.setLayout(expected);
      }
      return;
    }

    desktopPanelSizesRef.current = {
      code: layout.code,
      sidebar: layout.sidebar ?? desktopPanelSizesRef.current.sidebar,
      ioCollapsed: layout.io === 0,
    };
    layoutStorage.setItem(
      desktopLayoutStorageKey,
      JSON.stringify(desktopPanelSizesRef.current)
    );
  };

  return (
    <Group
      id="workspace-columns"
      groupRef={groupRef}
      defaultLayout={getDesktopLayout(defaultDesktopPanelSizes, showSidebar)}
      disabled={!isDesktop}
      onLayoutChanged={handleDesktopLayoutChanged}
    >
      <Panel
        id="code"
        collapsible={isDesktop}
        minSize={isDesktop ? '10%' : 0}
        hidden={!isDesktop && mobileActiveTab !== 'code'}
        className="h-full min-h-0"
      >
        <CodeInterface className="h-full min-w-0 overflow-hidden" />
      </Panel>
      {isDesktop && <PanelResizeHandle orientation="horizontal" />}
      <Panel
        id="io"
        collapsible={isDesktop}
        minSize={isDesktop ? '10%' : 0}
        hidden={!isDesktop && mobileActiveTab !== 'io'}
        className="h-full min-h-0"
      >
        <InputOutputPane
          handleRunCode={handleRunCode}
          layoutResetKey={layoutResetKey}
        />
      </Panel>
      {renderSidebar && (
        <>
          {isDesktop && <PanelResizeHandle orientation="horizontal" />}
          <Panel
            id="sidebar"
            minSize={isDesktop ? '8%' : 0}
            hidden={!isDesktop && mobileActiveTab !== 'users'}
            className="h-full min-h-0"
          >
            <SidebarPane />
          </Panel>
        </>
      )}
    </Group>
  );
}

export default function Workspace({
  handleRunCode,
  layoutResetKey,
}: {
  handleRunCode: () => void;
  layoutResetKey: number;
}): JSX.Element {
  const { fileData } = useEditorContext();
  const permission = useUserPermission();

  const fileSolved = fileData.solvedStatus?.solved ?? false;
  const previousFileSolvedRef = useRef(fileSolved);
  const hasSolutions = useAtomValue(hasSolutionsAtom);
  const loadedProblem = useAtomValue(problemAtom);
  const setInputTab = useSetAtom(inputTabAtom);
  const setSolved = useSetAtom(solvedAtom);
  const problemIsReady =
    !!fileData.problem &&
    loadedProblem?.platform === fileData.problem.platform &&
    loadedProblem.id === fileData.problem.id;

  useEffect(() => {
    if (problemIsReady) setInputTab('judge');
  }, [problemIsReady, setInputTab]);

  useEffect(() => {
    setSolved(fileSolved);
    if (
      !previousFileSolvedRef.current &&
      fileSolved &&
      hasSolutions &&
      permission === 'OWNER'
    ) {
      setInputTab('solutions');
    }
    previousFileSolvedRef.current = fileSolved;
  }, [fileSolved, hasSolutions, permission, setInputTab, setSolved]);

  return (
    <WorkspacePanels
      handleRunCode={handleRunCode}
      layoutResetKey={layoutResetKey}
    />
  );
}
