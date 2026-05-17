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
import { PlatformProblem, Translation } from '../../types/problem';
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

export default function Workspace({
  handleRunCode,
  tabsList,
}: {
  handleRunCode: () => void;
  tabsList: { label: string; value: string }[];
}): JSX.Element {
  const { fileData } = useEditorContext();
  const layoutEditors = useSetAtom(layoutEditorsAtom);
  const isDesktop = useMediaQuery('(min-width: 1024px)', true);
  const mobileActiveTab = useAtomValue(mobileActiveTabAtom);
  const showSidebar = useAtomValue(showSidebarAtom);
  const setInputEditor = useSetAtom(inputMonacoEditorAtom);
  const setCodemirrorInputEditor = useSetAtom(inputCodemirrorEditorAtom);
  const setOutputEditor = useSetAtom(outputMonacoEditorAtom);
  const [inputEditorHandle, setInputEditorHandle] =
    useState<EditorHandle | null>(null);
  const [inputTab, setInputTab] = useAtom(inputTabAtom);
  const [problem, setProblem] = useAtom(problemAtom);
  const [translations, setTranslations] = useAtom(translationsAtom);
  const [solutions, setSolutions] = useAtom(solutionsAtom);
  const setSolved = useSetAtom(solvedAtom);
  const [statusData, setStatusData] = useAtom(statusDataAtom);
  const [statusDataHistory, setStatusDataHistory] = useAtom(
    statusDataHistoryAtom
  );
  const [language, setLanguage] = useAtom(languageAtom);

  const permission = useUserPermission();
  const readOnly = !(permission === 'OWNER' || permission === 'READ_WRITE');
  const [judgeResults] = useJudgeResults();
  const db = getDatabase();

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

  useEffect(() => {
    if (!inputEditorHandle) {
      return;
    }

    if (isMonacoEditorHandle(inputEditorHandle)) {
      setInputEditor(inputEditorHandle.raw);
      return () => {
        setInputEditor(null);
      };
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

  useEffect(() => {
    (async () => {
      setStatusData(null);

      // FIXME: Do not store USACO problems directly in the Realtime DB.
      if (!fileData.problem) {
        setProblem(null);
        return;
      }

      const problemData = await fetchProblemFromDb(
        fileData.problem as PlatformProblem
      );

      setProblem(problemData);
      if (problemData) {
        setInputTab('judge');
        const translations = await fetchTranslationsFromDb(
          fileData.problem as PlatformProblem
        );

        translations['en'] ??= {
          hints: problemData.hints ?? [],
          ...(problemData.statementURL
            ? { statementURL: problemData.statementURL }
            : { statement: problemData.statement! }),
        };

        setTranslations(translations);
        setSolutions(
          await fetchSolutionsFromDb(fileData.problem as PlatformProblem)
        );
        setLanguage('hu' in translations ? 'hu' : 'en');
      }
    })();
  }, [fileData.problem?.platform]);

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

  const inputTabIndex = useAtomValue(inputTabIndexAtom);
  const { lightMode } = useUserContext().userData;

  useEffect(() => {
    setLanguage('hu' in translations ? 'hu' : 'en');
  }, [translations]);

  const gridColumns =
    isDesktop && !showSidebar
      ? 'grid-cols-[3fr,3px,2fr,0px,0px]'
      : 'grid-cols-[3fr,3px,2fr,3px,1fr]';

  return (
    <Split
      // Allow panes to shrink almost completely without breaking split-grid math.
      columnMinSize={1}
      rowMinSize={1}
      onDragEnd={() => layoutEditors()}
      render={({ getGridProps, getGutterProps }) => (
        <div
          className={`grid ${gridColumns} grid-rows-[2fr,3px,1fr] h-full overflow-hidden`}
          {...getGridProps()}
        >
          <CodeInterface
            className={classNames(
              'row-span-full min-w-0 overflow-hidden',
              !isDesktop && 'col-span-full',
              !isDesktop && mobileActiveTab !== 'code' && 'hidden'
            )}
          />
          <div
            className={classNames(
              'row-span-full col-start-2 cursor-[col-resize] mx-[-6px] group relative z-10',
              !isDesktop && 'hidden'
            )}
            {...getGutterProps('column', 1)}
          >
            <div className="absolute h-full left-[7px] right-[7px] bg-gray-700 group-hover:bg-gray-600 group-active:bg-gray-600 pointer-events-none transition" />
          </div>
          <div
            className={classNames(
              'flex flex-col min-h-0 overflow-hidden min-w-0',
              !isDesktop && 'col-span-full mb-[6px]',
              !isDesktop && mobileActiveTab !== 'io' && 'hidden',
              isDesktop && (showSidebar ? 'col-span-1' : 'col-span-3')
            )}
          >
            <TabBar
              tabs={tabsList}
              activeTab={inputTab}
              onTabSelect={x => setInputTab(x.value)}
            />
            <div className="flex-1 bg-[#1E1E1E] text-white min-h-0 overflow-hidden min-w-0">
              {inputTab === 'input' && (
                <LazyRealtimeEditor
                  theme={lightMode ? 'light' : 'dark'}
                  language={'plaintext'}
                  saveViewState={false}
                  path="input"
                  dataTestId="input-editor"
                  editorOptions={{
                    automaticLayout: false,
                    insertSpaces: false,
                    readOnly,
                  }}
                  onReady={handle => {
                    setInputEditorHandle(handle);
                    if (isMonacoEditorHandle(handle)) {
                      setTimeout(() => {
                        handle.layout();
                      }, 0);
                    }
                  }}
                  defaultValue="1 2 3"
                  yjsDocumentId={`${fileData.id}.input`}
                />
              )}
              {problem?.id === fileData.problem?.id &&
                inputTab === 'judge' &&
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
              {problem?.id === fileData.problem?.id &&
                inputTab === 'hints' &&
                translations && (
                  <Hints hints={getHints(translations, language)} />
                )}
              {problem?.id === fileData.problem?.id &&
                inputTab.startsWith('Sample') &&
                problem && (
                  <div className="overflow-y-auto h-full">
                    <div className="p-4 pb-0 relative h-full">
                      <Samples
                        samples={problem.samples}
                        inputTab={inputTab}
                        handleRunCode={handleRunCode}
                      />
                    </div>
                  </div>
                )}
              {problem?.id === fileData.problem?.id &&
                inputTab === 'solutions' &&
                problem && (
                  <div className="overflow-y-hidden h-full">
                    <div className="p-4 pb-0 relative h-full">
                      <Solutions problem={problem} solutions={solutions} />
                    </div>
                  </div>
                )}
            </div>
          </div>
          <div
            className={classNames(
              'cursor-[row-resize] group relative z-10 my-[-6px]',
              !isDesktop && 'col-span-full',
              !isDesktop && mobileActiveTab !== 'io' && 'hidden',
              isDesktop && (showSidebar ? 'col-span-1' : 'col-span-3')
            )}
            {...getGutterProps('row', 1)}
          >
            <div
              className={classNames(
                'absolute w-full bg-gray-700 group-hover:bg-gray-600 group-active:bg-gray-600 group-focus:bg-gray-600 pointer-events-none transition',
                isDesktop
                  ? 'top-[7px] bottom-[7px]'
                  : 'inset-y-0 bg-gray-800 flex items-center justify-center'
              )}
            >
              {!isDesktop && (
                <EllipsisHorizontalIcon className="h-5 w-5 text-gray-200" />
              )}
            </div>
          </div>
          <div
            className={classNames(
              'flex flex-col min-h-0 overflow-hidden min-w-0',
              !isDesktop && 'col-span-full mt-[6px]',
              !isDesktop && mobileActiveTab !== 'io' && 'hidden',
              isDesktop && (showSidebar ? 'col-span-1' : 'col-span-3')
            )}
          >
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
                setTimeout(() => {
                  handle.layout();
                }, 0);
              }}
            />
          </div>
          {((showSidebar && isDesktop) ||
            (!isDesktop && mobileActiveTab === 'users')) && (
            <>
              <div
                className={classNames(
                  'row-span-full col-start-4 cursor-[col-resize] mx-[-6px] group relative z-10',
                  !isDesktop && 'hidden'
                )}
                {...getGutterProps('column', 3)}
              >
                <div className="absolute h-full left-[7px] right-[7px] bg-gray-700 group-hover:bg-gray-600 group-active:bg-gray-600 pointer-events-none transition" />
              </div>
              <div
                className={classNames(
                  'row-span-full min-w-0 bg-[#1E1E1E] text-gray-200 flex flex-col overflow-auto',
                  isDesktop ? 'col-start-5' : 'col-span-full pt-4'
                )}
              >
                <UserList className="max-w-full max-h-64 lg:mt-3" />
                <Chat className="flex-1 min-h-0" />
              </div>
            </>
          )}
        </div>
      )}
    />
  );
}
