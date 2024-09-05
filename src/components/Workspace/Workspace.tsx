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
import {
  DataSnapshot,
  getDatabase,
  onValue,
  off,
  ref,
  update,
  get,
} from 'firebase/database';
import LoadResultsModal from '../JudgeInterface/LoadResultsModal';
import {
  Platform,
  PlatformProblem,
  ProblemData,
  StatusData,
  Translation,
} from '../../types/problem';
import {
  fetchProblemFromDb,
  fetchSolutionsFromDb,
  fetchTranslationsFromDb,
} from '../../scripts/fetchProblemFromDb';
import { PlatformSubmitButton } from '../JudgeInterface/PlatformSubmitButton';
import Dropdown from '../Dropdown';
import { CodeEditor } from '../editor/CodeEditor';
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
  const [inputTab, setInputTab] = useAtom(inputTabAtom);
  const [problem, setProblem] = useAtom(problemAtom);
  const [translations, setTranslations] = useAtom(translationsAtom);
  const [solutions, setSolutions] = useAtom(solutionsAtom);
  const setSolved = useSetAtom(solvedAtom);
  const [statusData, setStatusData] = useAtom(statusDataAtom);
  const [language, setLanguage] = useAtom(languageAtom);

  const permission = useUserPermission();
  const readOnly = !(permission === 'OWNER' || permission === 'READ_WRITE');
  const [judgeResults, setJudgeResults] = useJudgeResults();
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
    (async () => {
      setStatusData(null);

      // FIXME: Do not store USACO problems directly in the Realtime DB.
      if (!fileData.problem) {
        setProblem(undefined);
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
        if (problemData?.statement) {
          translations['en'] ??= {
            statement: problemData.statement,
            hints: problemData.hints ?? [],
          };
        }
        setTranslations(translations);
        setSolutions(
          await fetchSolutionsFromDb(fileData.problem as PlatformProblem)
        );
        setLanguage('hu' in translations ? 'hu' : 'en');
      }
    })();
  }, [fileData.problem?.platform]);

  useEffect(() => {
    console.log('Translations: ', translations);
  }, [translations]);

  useEffect(() => {
    get(ref(db, `files/${fileData.id}/solvedStatus/solved`)).then(
      (snapshot: DataSnapshot) => {
        const initSolved = snapshot.val();
        setSolved(initSolved);
        if (!initSolved) {
          onValue(
            ref(db, `files/${fileData.id}/solvedStatus/solved`),
            (snapshot: DataSnapshot) => {
              setSolved(snapshot.val());
              setInputTab('solutions');
            }
          );
        }
      }
    );
    return () => {
      off(ref(db, `files/${fileData.id}/solvedStatus/solved`));
    };
  }, []);

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

  const inputTabIndex = useAtomValue(inputTabIndexAtom);
  const { lightMode } = useUserContext().userData;

  useEffect(() => {
    setLanguage('hu' in translations ? 'hu' : 'en');
  }, [translations]);

  return (
    <Split
      onDragEnd={() => layoutEditors()}
      render={({ getGridProps, getGutterProps }) => (
        <div
          className={`grid grid-cols-[3fr,3px,2fr,3px,1fr] grid-rows-[2fr,3px,1fr] h-full overflow-hidden`}
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
              'flex flex-col min-h-0 overflow-hidden',
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
            <div className="flex-1 bg-[#1E1E1E] text-white min-h-0 overflow-hidden min-w-[24rem]">
              {inputTab === 'input' && (
                <LazyRealtimeEditor
                  theme={lightMode ? 'light' : 'dark'}
                  language={'plaintext'}
                  saveViewState={false}
                  path="input"
                  dataTestId="input-editor"
                  options={{
                    minimap: { enabled: false },
                    automaticLayout: false,
                    insertSpaces: false,
                    readOnly,
                  }}
                  onMount={e => {
                    setInputEditor(e);
                    setTimeout(() => {
                      e.layout();
                    }, 0);
                  }}
                  onCodemirrorMount={(view, state) => {
                    // this is used by e2e/helpers.ts to set the value of the input codemirror editor
                    // @ts-ignore
                    window['TEST_inputCodemirrorEditor'] = view;
                    setCodemirrorInputEditor(view);
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
              'flex flex-col min-h-0 overflow-hidden min-w-[24rem]',
              !isDesktop && 'col-span-full mt-[6px]',
              !isDesktop && mobileActiveTab !== 'io' && 'hidden',
              isDesktop && (showSidebar ? 'col-span-1' : 'col-span-3')
            )}
          >
            <Output
              result={judgeResults[inputTabIndex]}
              statusData={statusData}
              onMount={e => {
                setOutputEditor(e);
                setTimeout(() => {
                  e.layout();
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
                  'row-span-full min-w-[24rem] bg-[#1E1E1E] text-gray-200 flex flex-col overflow-auto',
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
