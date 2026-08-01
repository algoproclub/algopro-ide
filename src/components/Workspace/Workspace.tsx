import { EllipsisHorizontalIcon } from '@heroicons/react/20/solid';
import { useSetAtom, useAtomValue } from 'jotai';
import classNames from 'classnames';
import { useAtom } from 'jotai';
import React, { useEffect, useState } from 'react';
import Split from 'react-split-grid';
import {
  inputCodemirrorEditorAtom,
  inputMonacoEditorAtom,
  layoutEditorsAtom,
  outputMonacoEditorAtom,
} from '../../atoms/workspace';
import {
  inputTabAtom,
  inputTabIndexAtom,
  languageAtom,
  mobileActiveTabAtom,
  problemAtom,
  showSidebarAtom,
  solutionsAtom,
  solvedAtom,
  statusDataAtom,
  statusDataHistoryAtom,
  translationsAtom,
} from '../../atoms/workspaceUI';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Chat } from '../Chat';
import { CodeInterface } from '../CodeInterface/CodeInterface';
import { LazyRealtimeEditor } from '../RealtimeEditor/LazyRealtimeEditor';
import { Output } from '../Output';
import { TabBar } from '../TabBar';
import { UserList } from '../UserList/UserList';
import Samples from '../JudgeInterface/Samples';
import Hints from '../JudgeInterface/Hints';
import useJudgeResults from '../../hooks/useJudgeResults';
import USACOJudgeInterface from '../JudgeInterface/USACOJudgeInterface';
import GenericJudgeInterface from '../JudgeInterface/GenericJudgeInterface';
import { useEditorContext } from '../../context/EditorContext';
import useUserPermission from '../../hooks/useUserPermission';
import { useUserContext } from '../../context/UserContext';
import { EditorHandle, isMonacoEditorHandle } from '../editor/editor-types';
import {
  DataSnapshot,
  getDatabase,
  onValue,
  off,
  ref,
  get,
} from 'firebase/database';
import { Translation } from '../../types/problem';
import {
  fetchProblemFromDb,
  fetchSolutionsFromDb,
  fetchTranslationsFromDb,
} from '../../scripts/fetchProblemFromDb';
import Solutions from '../JudgeInterface/Solutions';

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
    // @ts-expect-error: this is used by e2e/helpers.ts to set the value of the input codemirror editor
    window['TEST_inputCodemirrorEditor'] = inputEditorHandle.raw;

    return () => {
      setCodemirrorInputEditor(null);
      // @ts-expect-error: this is used by e2e/helpers.ts to set the value of the input codemirror editor
      window['TEST_inputCodemirrorEditor'] = null;
    };
  }, [inputEditorHandle, setCodemirrorInputEditor, setInputEditor]);

  return (
    <div className="h-full overflow-hidden">
      <LazyRealtimeEditor
        theme={lightMode ? 'light' : 'dark'}
        language="plaintext"
        saveViewState={false}
        path="input"
        dataTestId="input-editor"
        editorOptions={{
          automaticLayout: false,
          insertSpaces: false,
          readOnly,
          fontSize,
        }}
        onReady={handle => {
          setInputEditorHandle(handle);
          if (isMonacoEditorHandle(handle)) {
            setTimeout(() => handle.layout(), 0);
          }
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
  const { fileData } = useEditorContext();
  const problem = useAtomValue(problemAtom);
  const translations = useAtomValue(translationsAtom);
  const [language, setLanguage] = useAtom(languageAtom);
  const [statusData, setStatusData] = useAtom(statusDataAtom);

  return (
    <div className="h-full overflow-hidden">
      {problem?.id === fileData.problem?.id &&
        problem &&
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

function InputTabPanel({
  tabId,
  handleRunCode,
}: {
  tabId: string;
  handleRunCode: () => void;
}): JSX.Element {
  const { fileData } = useEditorContext();
  const problem = useAtomValue(problemAtom);
  const translations = useAtomValue(translationsAtom);
  const language = useAtomValue(languageAtom);
  const solutions = useAtomValue(solutionsAtom);

  switch (tabId) {
    case 'input':
      return <WorkspaceInputPanel />;
    case 'judge':
      return <TaskOverviewPanel handleRunCode={handleRunCode} />;
    case 'hints':
      return (
        <div className="h-full overflow-hidden">
          {problem?.id === fileData.problem?.id && (
            <Hints hints={getHints(translations, language)} />
          )}
        </div>
      );
    case 'solutions':
      return (
        <div className="h-full overflow-hidden">
          {problem?.id === fileData.problem?.id && problem && (
            <div className="relative h-full p-4 pb-0">
              <Solutions problem={problem} solutions={solutions} />
            </div>
          )}
        </div>
      );
    default:
      return (
        <div className="h-full overflow-y-auto">
          {problem?.id === fileData.problem?.id && problem && (
            <div className="relative h-full p-4 pb-0">
              <Samples
                samples={problem.samples}
                inputTab={tabId}
                handleRunCode={handleRunCode}
              />
            </div>
          )}
        </div>
      );
  }
}

function InputPane({
  tabsList,
  handleRunCode,
}: {
  tabsList: { label: string; value: string }[];
  handleRunCode: () => void;
}): JSX.Element {
  const [inputTab, setInputTab] = useAtom(inputTabAtom);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <TabBar
        tabs={tabsList}
        activeTab={inputTab}
        onTabSelect={tab => setInputTab(tab.value)}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-[var(--panel-bg)] text-[color:var(--text-primary)]">
        <InputTabPanel tabId={inputTab} handleRunCode={handleRunCode} />
      </div>
    </div>
  );
}

function OutputPane(): JSX.Element {
  const inputTabIndex = useAtomValue(inputTabIndexAtom);
  const [judgeResults] = useJudgeResults();
  const statusData = useAtomValue(statusDataAtom);
  const statusDataHistory = useAtomValue(statusDataHistoryAtom);
  const setOutputEditor = useSetAtom(outputMonacoEditorAtom);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <Output
        result={judgeResults[inputTabIndex]}
        statusData={statusData}
        statusDataHistory={statusDataHistory}
        onReady={handle => {
          if (!isMonacoEditorHandle(handle)) {
            setOutputEditor(null);
            return;
          }

          setOutputEditor(handle.raw);
          setTimeout(() => handle.layout(), 0);
        }}
      />
    </div>
  );
}

function SidebarPane(): JSX.Element {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-auto bg-[var(--panel-bg)] text-[color:var(--text-primary)]">
      <UserList className="max-h-64 max-w-full lg:mt-3" />
      <Chat className="min-h-0 flex-1" />
    </div>
  );
}

function WorkspacePanels({
  handleRunCode,
  tabsList,
}: {
  handleRunCode: () => void;
  tabsList: { label: string; value: string }[];
}): JSX.Element {
  const layoutEditors = useSetAtom(layoutEditorsAtom);
  const isDesktop = useMediaQuery('(min-width: 1024px)', true);
  const mobileActiveTab = useAtomValue(mobileActiveTabAtom);
  const showSidebar = useAtomValue(showSidebarAtom);

  useEffect(() => {
    function handleResize() {
      layoutEditors();
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [layoutEditors]);

  useEffect(() => {
    if (!isDesktop) {
      layoutEditors();
    }
  }, [isDesktop, mobileActiveTab, layoutEditors]);

  const gridColumns =
    isDesktop && !showSidebar
      ? 'grid-cols-[3fr,3px,2fr,0px,0px]'
      : 'grid-cols-[3fr,3px,2fr,3px,1fr]';

  return (
    <Split
      columnMinSize={1}
      rowMinSize={1}
      onDragEnd={() => layoutEditors()}
      render={({ getGridProps, getGutterProps }) => (
        <div
          className={`grid ${gridColumns} h-full grid-rows-[2fr,3px,1fr] overflow-hidden`}
          {...getGridProps()}
        >
          <div
            className={classNames(
              'row-span-full min-w-0 overflow-hidden',
              !isDesktop && 'col-span-full',
              !isDesktop && mobileActiveTab !== 'code' && 'hidden'
            )}
          >
            <CodeInterface className="h-full min-w-0 overflow-hidden" />
          </div>
          <div
            className={classNames(
              'group relative z-10 col-start-2 row-span-full mx-[-6px] cursor-[col-resize]',
              !isDesktop && 'hidden'
            )}
            {...getGutterProps('column', 1)}
          >
            <div className="pointer-events-none absolute right-[7px] left-[7px] h-full bg-[var(--gutter)] transition group-hover:bg-[var(--gutter-hover)] group-active:bg-[var(--gutter-hover)]" />
          </div>
          <div
            className={classNames(
              'flex min-h-0 min-w-0 flex-col overflow-hidden',
              !isDesktop && 'col-span-full mb-[6px]',
              !isDesktop && mobileActiveTab !== 'io' && 'hidden',
              isDesktop && (showSidebar ? 'col-span-1' : 'col-span-3')
            )}
          >
            <InputPane tabsList={tabsList} handleRunCode={handleRunCode} />
          </div>
          <div
            className={classNames(
              'group relative z-10 my-[-6px] cursor-[row-resize]',
              !isDesktop && 'col-span-full',
              !isDesktop && mobileActiveTab !== 'io' && 'hidden',
              isDesktop && (showSidebar ? 'col-span-1' : 'col-span-3')
            )}
            {...getGutterProps('row', 1)}
          >
            <div
              className={classNames(
                'pointer-events-none absolute w-full bg-[var(--gutter)] transition group-hover:bg-[var(--gutter-hover)] group-focus:bg-[var(--gutter-hover)] group-active:bg-[var(--gutter-hover)]',
                isDesktop
                  ? 'top-[7px] bottom-[7px]'
                  : 'inset-y-0 flex items-center justify-center bg-[var(--gutter)]'
              )}
            >
              {!isDesktop && (
                <EllipsisHorizontalIcon className="h-5 w-5 text-[color:var(--text-secondary)]" />
              )}
            </div>
          </div>
          <div
            className={classNames(
              'flex min-h-0 min-w-0 flex-col overflow-hidden',
              !isDesktop && 'col-span-full mt-[6px]',
              !isDesktop && mobileActiveTab !== 'io' && 'hidden',
              isDesktop && (showSidebar ? 'col-span-1' : 'col-span-3')
            )}
          >
            <OutputPane />
          </div>
          {((showSidebar && isDesktop) ||
            (!isDesktop && mobileActiveTab === 'users')) && (
            <>
              <div
                className={classNames(
                  'group relative z-10 col-start-4 row-span-full mx-[-6px] cursor-[col-resize]',
                  !isDesktop && 'hidden'
                )}
                {...getGutterProps('column', 3)}
              >
                <div className="pointer-events-none absolute right-[7px] left-[7px] h-full bg-[var(--gutter)] transition group-hover:bg-[var(--gutter-hover)] group-active:bg-[var(--gutter-hover)]" />
              </div>
              <div
                className={classNames(
                  'row-span-full min-w-0',
                  isDesktop ? 'col-start-5' : 'col-span-full pt-4'
                )}
              >
                <SidebarPane />
              </div>
            </>
          )}
        </div>
      )}
    />
  );
}

export default function Workspace({
  handleRunCode,
  tabsList,
}: {
  handleRunCode: () => void;
  tabsList: { label: string; value: string }[];
}): JSX.Element {
  const { fileData } = useEditorContext();
  const setInputTab = useSetAtom(inputTabAtom);
  const setProblem = useSetAtom(problemAtom);
  const setTranslations = useSetAtom(translationsAtom);
  const [solutions, setSolutions] = useAtom(solutionsAtom);
  const setSolved = useSetAtom(solvedAtom);
  const setStatusData = useSetAtom(statusDataAtom);
  const setStatusDataHistory = useSetAtom(statusDataHistoryAtom);
  const setLanguage = useSetAtom(languageAtom);

  const db = getDatabase();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatusData(null);
      setTranslations({});
      setSolutions({});

      if (!fileData.problem) {
        setProblem(null);
        return;
      }

      setProblem(undefined);
      const problemData = await fetchProblemFromDb(fileData.problem);

      if (cancelled) return;

      setProblem(problemData);
      if (problemData) {
        setInputTab('judge');
        const translations = await fetchTranslationsFromDb(fileData.problem);

        if (cancelled) return;

        translations['en'] ??= {
          hints: problemData.hints ?? [],
          ...(problemData.statementURL
            ? { statementURL: problemData.statementURL }
            : { statement: problemData.statement! }),
        };

        setTranslations(translations);
        const solutions = await fetchSolutionsFromDb(fileData.problem);

        if (cancelled) return;

        setSolutions(solutions);
        setLanguage('hu' in translations ? 'hu' : 'en');
      }
    })();

    return () => {
      cancelled = true;
    };
    // The RTDB object can change independently; only its identity triggers this load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileData.problem?.platform, fileData.problem?.id]);

  useEffect(() => {
    get(ref(db, `files/${fileData.id}/solvedStatus/solved`)).then(
      (snapshot: DataSnapshot) => {
        const initSolved = snapshot.val() ?? false;
        setSolved(initSolved);
        if (!initSolved && Object.keys(solutions).length > 0) {
          onValue(
            ref(db, `files/${fileData.id}/solvedStatus/solved`),
            (snapshot: DataSnapshot) => {
              if (snapshot.val()) {
                setSolved(snapshot.val());
                setInputTab('solutions');
              }
            }
          );
        }
      }
    );
    return () => {
      off(ref(db, `files/${fileData.id}/solvedStatus/solved`));
    };
  }, [solutions]);

  useEffect(() => {
    onValue(
      ref(db, `submissions/${fileData.id}/statusData`),
      (snapshot: DataSnapshot) => {
        setStatusData(snapshot.val());
      }
    );
    return () => {
      off(ref(db, `submissions/${fileData.id}/statusData`));
    };
  }, []);

  useEffect(() => {
    onValue(
      ref(db, `submissions/${fileData.id}/statusDataHistory`),
      (snapshot: DataSnapshot) => {
        setStatusDataHistory(snapshot.val());
      }
    );
    return () => {
      off(ref(db, `submissions/${fileData.id}/statusDataHistory`));
    };
  }, []);

  return <WorkspacePanels tabsList={tabsList} handleRunCode={handleRunCode} />;
}
