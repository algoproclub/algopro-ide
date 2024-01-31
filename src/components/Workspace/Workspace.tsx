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
import useJudgeResults from '../../hooks/useJudgeResults';
import USACOJudgeInterface from '../JudgeInterface/USACOJudgeInterface';
import { useEditorContext } from '../../context/EditorContext';
import useUserPermission from '../../hooks/useUserPermission';
import { useUserContext } from '../../context/UserContext';
import LoadResultsModal from './LoadResultsModal';
import { StatusData } from '../../types/problem';
import {
  DataSnapshot,
  getDatabase,
  onValue,
  off,
  ref,
  update,
} from 'firebase/database';

export default function Workspace({
  handleRunCode,
  tabsList,
}: {
  handleRunCode: () => void;
  tabsList: { label: string; value: string }[];
}): JSX.Element {
  const { fileData } = useEditorContext();
  const { userData } = useUserContext();
  const layoutEditors = useUpdateAtom(layoutEditorsAtom);
  const isDesktop = useMediaQuery('(min-width: 1024px)', true);
  const mobileActiveTab = useAtomValue(mobileActiveTabAtom);
  const [inputTab, setInputTab] = useAtom(inputTabAtom);
  const showSidebar = useAtomValue(showSidebarAtom);
  const setInputEditor = useUpdateAtom(inputMonacoEditorAtom);
  const setCodemirrorInputEditor = useUpdateAtom(inputCodemirrorEditorAtom);
  const setOutputEditor = useUpdateAtom(outputMonacoEditorAtom);
  const [problem, setProblem] = useAtom(problemAtom);

  const permission = useUserPermission();
  const readOnly = !(permission === 'OWNER' || permission === 'READ_WRITE');
  const [judgeResults, setJudgeResults] = useJudgeResults();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const db = getDatabase();

  const updateStatusData = (snapshot: DataSnapshot) => {
    const data = snapshot.val();
    setStatusData(data);
  };

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
    // setStatusData(null);
    setProblem(fileData.problem);
    if (fileData.problem) {
      setInputTab('judge');
    }
  }, [fileData.problem?.id]);

  useEffect(() => {
    onValue(ref(db, `submissions/${fileData.id}/statusData`), updateStatusData);
    return () => {
      off(ref(db, `submissions/${fileData.id}/statusData`));
    };
  }, []);

  const inputTabIndex = useAtomValue(inputTabIndexAtom);
  const { lightMode } = useUserContext().userData;

  const [submitDisabled, setSubmitDisabled] = useState(true);
  const updateProblemData = () => {
    const platform = (document.getElementById('platform') as HTMLInputElement)
      .value;
    const problemID = (document.getElementById('problemID') as HTMLInputElement)
      .value;

    const submitButton = document.getElementById(
      'submit-button'
    ) as HTMLInputElement;
    setSubmitDisabled(false);
    submitButton.classList.add('bg-indigo-500');
    submitButton.classList.remove('bg-indigo-400');

    update(ref(db, `files/${fileData.id}/problem`), {
      id: problemID,
      platform: platform,
    });
  };

  const submitSolution = () => {
    const getSubmitLink = async () => {
      const platform = fileData.problem.platform;
      const problemID = fileData.problem.id;

      let submitLink = '';
      if (platform === 'codeforces') {
        submitLink = `https://codeforces.com/problemset/problem/${
          problemID.split('_')[0]
        }/${problemID.split('_')[1]}`;
      }
      if (platform === 'atcoder') {
        submitLink = `https://atcoder.jp/contests/${
          problemID.split('_')[0]
        }/tasks/${problemID}`;
      }
      if (platform === 'cses') {
        submitLink = `https://cses.fi/problemset/submit/${problemID}/`;
      }
      return submitLink;
    };
    if (userData.manualSubmission) {
      getSubmitLink().then(link => {
        window.open(link, '_blank');
      });
      setIsOpen(true);
    } else {
      alert('Automatic submission is not implemented yet.');
    }
  };

  return (
    <>
      <LoadResultsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        setStatusData={setStatusData}
        updateStatusData={updateStatusData}
      />
      {/*for testing purposes*/}
      <div className="flex flex-col items-center mb-4 space-y-2 hidden">
        <input id="platform" type="text" placeholder="platform" />
        <input id="problemID" type="text" placeholder="problem ID" />
        <div className="flex space-x-2">
          <button
            className="text-white bg-indigo-500 px-4 py-2 rounded"
            onClick={updateProblemData}
          >
            update
          </button>
          <button
            disabled={submitDisabled}
            id="submit-button"
            className="text-white bg-indigo-400 px-4 py-2 rounded"
            onClick={submitSolution}
          >
            sbmit
          </button>
        </div>
      </div>
      <Split
        onDragEnd={() => layoutEditors()}
        render={({ getGridProps, getGutterProps }) => (
          <div
            className={`grid grid-cols-[3fr,3px,2fr,3px,1fr] grid-rows-[1fr,3px,1fr] h-full overflow-hidden`}
            {...getGridProps()}
          >
            <CodeInterface
              className={classNames(
                'row-span-full min-w-0 overflow-hidden border-t border-black',
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
              <div className="absolute h-full left-[6px] right-[6px] bg-black group-hover:bg-gray-600 group-active:bg-gray-600 pointer-events-none transition" />
            </div>
            <div
              className={classNames(
                'flex flex-col min-w-0 min-h-0 overflow-hidden',
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
              <div className="flex-1 bg-[#1E1E1E] text-white min-h-0 overflow-hidden">
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
                {/* not using any judge interface, for testing purposes
                {inputTab === '_judge' &&
                */}
                {inputTab === 'judge' &&
                  problem &&
                  (isNaN(Number(problem.id)) ? (
                    <PlanetsJudgeInterface
                      problem={problem}
                      statusData={statusData}
                      setStatusData={setStatusData}
                      handleRunCode={handleRunCode}
                    />
                  ) : (
                    <USACOJudgeInterface
                      problem={problem}
                      statusData={statusData}
                      setStatusData={setStatusData}
                      handleRunCode={handleRunCode}
                    />
                  ))}
                {inputTab.startsWith('Sample') && problem && (
                  <div className="overflow-y-auto h-full">
                    <div className="p-4 pb-0">
                      <Samples
                        samples={problem.samples}
                        inputTab={inputTab}
                        handleRunCode={handleRunCode}
                      />
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
                  'absolute w-full bg-black group-hover:bg-gray-600 group-active:bg-gray-600 group-focus:bg-gray-600 pointer-events-none transition',
                  isDesktop
                    ? 'top-[6px] bottom-[6px]'
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
                'flex flex-col min-w-0 min-h-0 overflow-hidden',
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
                  <div className="absolute h-full left-[6px] right-[6px] bg-black group-hover:bg-gray-600 group-active:bg-gray-600 pointer-events-none transition" />
                </div>
                <div
                  className={classNames(
                    'row-span-full min-w-0 bg-[#1E1E1E] text-gray-200 flex flex-col overflow-auto',
                    isDesktop ? 'col-start-5' : 'col-span-full pt-4'
                  )}
                >
                  <UserList className="max-w-full max-h-64" />
                  <Chat className="flex-1 p-4 min-h-0" />
                </div>
              </>
            )}
          </div>
        )}
      />
    </>
  );
}
