import { useRouter } from 'next/router';
import { MessagePage } from '../src/components/MessagePage';
import { FileMenu } from '../src/components/NavBar/FileMenu';
import { NavBar } from '../src/components/NavBar/NavBar';
import { EditorProvider, useEditorContext } from '../src/context/EditorContext';
import { RunButton } from '../src/components/RunButton';
import { submitToJudge } from '../src/scripts/judge';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  inputEditorValueAtom,
  layoutEditorsAtom,
  loadingAtom,
  mainEditorValueAtom,
  mainMonacoEditorAtom,
  isLineHighlightSetAtom,
  savedEditorValue,
} from '../src/atoms/workspace';
import {
  inputTabAtom,
  inputTabIndexAtom,
  mobileActiveTabAtom,
  showSidebarAtom,
  tabsListAtom,
} from '../src/atoms/workspaceUI';
import React, { useEffect, useState } from 'react';
import { useMediaQuery } from '../src/hooks/useMediaQuery';
import Workspace from '../src/components/Workspace/Workspace';
import { MobileBottomNav } from '../src/components/NavBar/MobileBottomNav';
import { useNullableUserContext } from '../src/context/UserContext';
import useUserPermission from '../src/hooks/useUserPermission';
import { WorkspaceSettingsModal } from '../src/components/settings/WorkspaceSettingsModal';
import { getSampleIndex } from '../src/components/JudgeInterface/Samples';
import useJudgeResults from '../src/hooks/useJudgeResults';
import { cleanJudgeResult } from '../src/editorUtils';
import JudgeResult from '../src/types/judge';
import useUserFileConnection from '../src/hooks/useUserFileConnection';
import useUpdateUserDashboard from '../src/hooks/useUpdateUserDashboard';
import { ConfirmOverrideModal } from '../src/components/ConfirmOverrideModal';
import { ProblemData } from '../src/types/problem';
import { fetchProblemFromDb } from '../src/scripts/fetchProblemFromDb';
import Link from 'next/link';
import ProfileSettings from '../src/components/settings/ProfileSettings';
import WithRegistration from '../src/components/WithRegistration';

function EditorPage() {
  const { fileData, updateFileData } = useEditorContext();
  const permission = useUserPermission();
  const loading = useAtomValue(loadingAtom);
  const [showSidebar, setShowSidebar] = useAtom(showSidebarAtom);
  const readOnly = !(permission === 'OWNER' || permission === 'READ_WRITE');
  const [isWorkspaceSettingsModalOpen, setIsWorkspaceSettingsModalOpen] =
    useState(false);
  const [isProfileSettingsModalOpen, setIsProfileSettingsModalOpen] =
    useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)', true);
  const layoutEditors = useSetAtom(layoutEditorsAtom);
  const [mobileActiveTab, setMobileActiveTab] = useAtom(mobileActiveTabAtom);
  const getMainEditorValue = useAtomValue(mainEditorValueAtom);
  const getInputEditorValue = useAtomValue(inputEditorValueAtom);
  const [judgeResults, setJudgeResults] = useJudgeResults();
  const setIsLineHighlightSet = useSetAtom(isLineHighlightSetAtom);
  const setSavedEditorValue = useSetAtom(savedEditorValue);
  const mainMonacoEditor = useAtomValue(mainMonacoEditorAtom);

  useUserFileConnection();
  useUpdateUserDashboard();

  const [inputTab, setInputTab] = useAtom(inputTabAtom);
  const inputTabIndex = useAtomValue(inputTabIndexAtom);

  let tabsList = useAtomValue(tabsListAtom);

  if (!fileData.problem) {
    tabsList = tabsList.filter(
      ({ value }) => value != 'judge' && !value.startsWith('Sample')
    );
    setInputTab('input');
  }
  useEffect(() => {
    if (inputTabIndex === tabsList.length) {
      // current tab doesn't exist
      setInputTab(tabsList[0].value);
    }
  }, [tabsList, inputTab, setInputTab, inputTabIndex]);

  const handleToggleSidebar = () => {
    setShowSidebar(show => !show);
    setTimeout(() => {
      layoutEditors();
    }, 0);
  };

  const handleRunCode = async () => {
    // FIXME: Do not store USACO problems directly in the Realtime DB.
    let problem: ProblemData | undefined = undefined;
    if (fileData.problem) {
      problem =
        fileData.problem?.platform === 'usaco'
          ? (fileData.problem as ProblemData)
          : await fetchProblemFromDb(fileData.problem);
    }
    const setIsRunning = (isRunning: boolean) => {
      updateFileData({
        isCodeRunning: isRunning,
      });
    };
    const fetchJudge = (code: string, input: string): Promise<Response> => {
      return submitToJudge(
        fileData.settings.language,
        code,
        input,
        fileData.settings.compilerOptions[fileData.settings.language],
        problem?.input?.endsWith('.in')
          ? problem.input.substring(0, problem.input.length - 3)
          : undefined
      );
    };

    const setResultAt = (index: number, data: JudgeResult | null) => {
      const newJudgeResults = judgeResults;
      while (newJudgeResults.length <= index) newJudgeResults.push(null);
      newJudgeResults[index] = data;
      setJudgeResults(newJudgeResults);
    };

    const runWithInput = (
      input: string,
      expectedOutput?: string,
      prefix?: string
    ) => {
      if (!getMainEditorValue) {
        // editor is still loading
        return;
      }

      setIsRunning(true);
      setResultAt(inputTabIndex, null);

      const code = getMainEditorValue();
      fetchJudge(code, input)
        .then(async resp => {
          const data: JudgeResult = await resp.json();
          if (!resp.ok) {
            if (data.debugData?.errorType === 'Function.ResponseSizeTooLarge') {
              alert(
                'Error: Your program printed too much data to stdout/stderr.'
              );
            } else {
              alert('Error: ' + (resp.status + ' - ' + JSON.stringify(data)));
            }
          } else {
            cleanJudgeResult(data, expectedOutput, prefix);
            setResultAt(inputTabIndex, data);
          }
        })
        .catch(e => {
          alert(
            'Error: ' +
              e.message +
              '. Perhaps the server is down, or your input is too large.'
          );
          console.error(e);
        })
        .finally(() => setIsRunning(false));
    };

    const runAllList = ['judge', 'hints', 'solutions'];

    const runAllSamples = async () => {
      if (!problem || !getMainEditorValue) {
        // editor is still loading
        return;
      }
      const samples = problem.samples;

      setIsRunning(true);
      setResultAt(1, null);

      const code = getMainEditorValue();
      try {
        const promises = [];
        for (let index = 0; index < samples.length; ++index) {
          const sample = samples[index];
          promises.push(fetchJudge(code, sample.input));
        }

        const newJudgeResults = judgeResults;
        const results: JudgeResult[] = [];

        let lastIndex = 0;
        for (let index = 0; index < samples.length; ++index) {
          const sample = samples[index];
          const resp = await promises[index];
          const data: JudgeResult = await resp.json();
          if (!resp.ok || data.status === 'internal_error') {
            alert(
              'Error: ' +
                (data.message || resp.status + ' - ' + JSON.stringify(data))
            );
            console.error(data);
            throw new Error('bad judge result');
          }
          let prefix = 'Sample';
          if (samples.length > 1) prefix += ` ${index + 1}`;
          prefix += ': ';
          if (!sample.output) prefix = '';
          cleanJudgeResult(data, sample.output, prefix);
          results.push(data);
          let tabName = 'Sample';
          if (samples.length > 1) tabName += ` ${index + 1}`;
          let tabIndex = tabsList.findIndex(tab => tab.label === tabName); // Find the index in tablists
          if (tabIndex === -1) tabIndex = tabsList.length + index;
          newJudgeResults[tabIndex] = data;
          lastIndex = tabIndex;
        }
        if (samples.length > 1) {
          let verdicts = '';
          for (const result of results) {
            // https://newjudge0.usaco.guide/#statuses-and-languages-status-get
            if (result.status === 'compile_error') {
              // compilation error
              setJudgeResults([result]);
              break;
            }
            if (result.status === 'success') verdicts += 'A';
            else if (result.status === 'wrong_answer') verdicts += 'W';
            else if (result.status === 'time_limit_exceeded') verdicts += 'T';
            else if (result.status === 'runtime_error') verdicts += 'R';
            else verdicts += '?';
          }
          let firstFailed = 0;
          while (
            firstFailed < samples.length - 1 &&
            verdicts[firstFailed] === 'A'
          )
            ++firstFailed;

          const failedResult: JudgeResult = JSON.parse(
            JSON.stringify(results[firstFailed])
          );
          if (verdicts.length > 1)
            failedResult.statusDescription =
              'Sample Verdicts: ' +
              verdicts +
              '. ' +
              failedResult.statusDescription;
          newJudgeResults[1] = failedResult;
          runAllList.forEach((item, index) => {
            let tabindex = tabsList.findIndex(tab => tab.value === item);
            if (tabindex === -1) tabindex = tabsList.length + index;
            newJudgeResults[tabindex] = failedResult;
          });
        } else {
          runAllList.forEach(item => {
            const tabindex = tabsList.findIndex(tab => tab.value === item);
            if (tabindex === -1) {
              return;
            }
            newJudgeResults[tabindex] = newJudgeResults[lastIndex];
          });
        }
        setJudgeResults(newJudgeResults);
      } catch (e) {
        console.error(e);
      }
      setIsRunning(false);
    };

    setSavedEditorValue(getMainEditorValue ? getMainEditorValue() : null);

    if (inputTab === 'input') {
      if (getInputEditorValue) runWithInput(getInputEditorValue());
    } else if (runAllList.includes(inputTab)) {
      runAllSamples();
    } else {
      const samples = problem?.samples;
      if (samples) {
        const index = getSampleIndex(inputTab);
        const sample = samples[index - 1];
        runWithInput(sample.input, sample.output, inputTab + ': ');
      }
    }
    setIsLineHighlightSet(false);
    mainMonacoEditor?.clearLineHighlight();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 's') event.preventDefault();
      if (event.key === 'Enter') handleRunCode();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  return (
    <div className="h-full">
      <div className="h-full flex flex-col">
        {/* szda re-theme phase1: the workspace page shell follows the root theme tokens. */}
        <div className="flex-shrink-0 bg-[var(--panel-bg)] text-[var(--text-primary)]">
          <NavBar
            fileMenu={
              <FileMenu
                onOpenSettings={() => setIsWorkspaceSettingsModalOpen(true)}
              />
            }
            runButton={
              <RunButton
                onClick={handleRunCode}
                showLoading={fileData.isCodeRunning || loading}
                disabledForViewOnly={readOnly}
              />
            }
            showViewOnly={!loading && readOnly}
            isSidebarOpen={showSidebar}
            onToggleSidebar={handleToggleSidebar}
            showSidebarButton={isDesktop}
            setIsProfileSettingsOpen={setIsProfileSettingsModalOpen}
          />
        </div>
        <div className="flex-1 min-h-0">
          <Workspace handleRunCode={handleRunCode} tabsList={tabsList} />
        </div>
        {!isDesktop && (
          <MobileBottomNav
            activeTab={mobileActiveTab}
            onActiveTabChange={setMobileActiveTab}
          />
        )}
      </div>

      <WorkspaceSettingsModal
        isOpen={isWorkspaceSettingsModalOpen}
        onClose={() => setIsWorkspaceSettingsModalOpen(false)}
      />
      <ProfileSettings
        isOpen={isProfileSettingsModalOpen}
        onClose={() => setIsProfileSettingsModalOpen(false)}
      />
    </div>
  );
}

function PageContent() {
  const router = useRouter();
  const queryId = router.query.id;
  const firebaseFileID = '-' + queryId;
  const { userData, logged } = useNullableUserContext();

  const loginUI = (
    <MessagePage
      message="Please login to view this file."
      showHomeButton={true}
    />
  );
  const loadingUI = <MessagePage message="Loading..." showHomeButton={false} />;
  const fileNotFoundUI = (
    <div className="p-8 sm:p-16">
      <div className="max-w-prose mx-auto">
        <div className="text-3xl sm:text-4xl text-white font-bold">
          File Not Found
        </div>
        <p className="sm:text-lg mt-3 text-gray-200 max-w-prose mx-auto text-left">
          Please check that the entered file ID is correct.
        </p>
        <Link
          href="/"
          className="mt-4 sm:mt-6 inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-[#1E1E1E]"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
  const permissionDeniedUI = <MessagePage message="This file is private." />;

  if (!queryId) return null;
  if (logged === false) return loginUI;
  if (!userData) return loadingUI;

  return (
    <>
      <EditorProvider
        fileId={firebaseFileID}
        loadingUI={loadingUI}
        fileNotFoundUI={fileNotFoundUI}
        permissionDeniedUI={permissionDeniedUI}
      >
        <EditorPage />
      </EditorProvider>
      <ConfirmOverrideModal />
    </>
  );
}

export default function FilePage() {
  return (
    <WithRegistration>
      <PageContent />
    </WithRegistration>
  );
}
