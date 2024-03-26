import { EllipsisHorizontalIcon } from '@heroicons/react/20/solid';
import { useAtomValue, useUpdateAtom } from 'jotai/utils';
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
  mobileActiveTabAtom,
  problemAtom,
  showSidebarAtom,
  translationsAtom,
} from '../../atoms/workspaceUI';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Chat } from '../Chat';
import { CodeInterface } from '../CodeInterface/CodeInterface';
import PlanetsJudgeInterface from '../JudgeInterface/PlanetsJudgeInterface';
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
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import {
  DataSnapshot,
  getDatabase,
  onValue,
  off,
  ref,
  update,
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
  fetchTranslationsFromDb,
} from '../../scripts/fetchProblemFromDb';
import { PlatformSubmitButton } from '../JudgeInterface/PlatformSubmitButton';

export function getHints(
  problem: ProblemData,
  translations: Record<string, Translation>
) {
  return 'hu' in translations ? translations['hu'].hints : problem.hints ?? [];
}

export default function Workspace({
  handleRunCode,
  tabsList,
}: {
  handleRunCode: () => void;
  tabsList: { label: string; value: string }[];
}): JSX.Element {
  const { fileData } = useEditorContext();
  const layoutEditors = useUpdateAtom(layoutEditorsAtom);
  const isDesktop = useMediaQuery('(min-width: 1024px)', true);
  const mobileActiveTab = useAtomValue(mobileActiveTabAtom);
  const [inputTab, setInputTab] = useAtom(inputTabAtom);
  const showSidebar = useAtomValue(showSidebarAtom);
  const setInputEditor = useUpdateAtom(inputMonacoEditorAtom);
  const setCodemirrorInputEditor = useUpdateAtom(inputCodemirrorEditorAtom);
  const setOutputEditor = useUpdateAtom(outputMonacoEditorAtom);
  const [problem, setProblem] = useAtom(problemAtom);
  const [translations, setTranslations] = useAtom(translationsAtom);

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

  const [statusData, setStatusData] = useState<StatusData | null>(null);

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
        setTranslations(
          await fetchTranslationsFromDb(fileData.problem as PlatformProblem)
        );
      }
    })();
  }, [fileData.problem?.platform]);

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

  const [language, setLanguage] = React.useState('en');

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
                  theme={lightMode ? 'light' : 'vs-dark'}
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
                problem &&
                translations && (
                  <Hints hints={getHints(problem, translations)} />
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
            </div>
            {problem?.submittable && problem.id === fileData.problem?.id && (
              <PlatformSubmitButton
                platform={problem.platform}
                statusData={statusData}
                setStatusData={setStatusData}
              />
            )}
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
