import { useRouter } from 'next/router';
import { MessagePage } from '../src/components/MessagePage';
import { FileMenu } from '../src/components/NavBar/FileMenu';
import { NavBar } from '../src/components/NavBar/NavBar';
import { EditorProvider, useEditorContext } from '../src/context/EditorContext';
import { RunButton } from '../src/components/RunButton';
import { RunCodeError, runCode, runCodeBatch } from '../src/scripts/runCode';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  inputEditorValueAtom,
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
  problemAtom,
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
import Link from 'next/link';
import ProfileSettings from '../src/components/settings/ProfileSettings';
import WithRegistration from '../src/components/WithRegistration';
import { beginCodeRun, endCodeRun } from '../src/scripts/codeRun';
import useCodeRunActive from '../src/hooks/useCodeRunActive';
import useServerTimeOffset from '../src/hooks/useServerTimeOffset';
import { HocuspocusProviderWebsocketComponent } from '@hocuspocus/provider-react';
import PageTitle from '../src/components/PageTitle';

function runCodeErrorToResult(error: unknown): JudgeResult {
  const runCodeError = error instanceof RunCodeError ? error : undefined;
  const status = runCodeError?.status ? `${runCodeError.status} ` : '';
  const debugData: JudgeResult['debugData'] = {
    source: 'run_code',
    kind: runCodeError?.kind ?? 'unexpected',
  };
  if (runCodeError?.status !== undefined)
    debugData.status = runCodeError.status;

  return {
    status: 'internal_error',
    statusDescription: 'Run Code Error',
    message:
      `${status}${error instanceof Error ? error.message : String(error)}`.trim(),
    stdout: '',
    stderr: '',
    time: '',
    memory: '',
    debugData,
  };
}

function EditorPage() {
  const { fileData } = useEditorContext();
  const permission = useUserPermission();
  const loading = useAtomValue(loadingAtom);
  const [showSidebar, setShowSidebar] = useAtom(showSidebarAtom);
  const readOnly = !(permission === 'OWNER' || permission === 'READ_WRITE');
  const [isWorkspaceSettingsModalOpen, setIsWorkspaceSettingsModalOpen] =
    useState(false);
  const [isProfileSettingsModalOpen, setIsProfileSettingsModalOpen] =
    useState(false);
  const [layoutResetKey, setLayoutResetKey] = useState(0);
  const isDesktop = useMediaQuery('(min-width: 1024px)', true);
  const [mobileActiveTab, setMobileActiveTab] = useAtom(mobileActiveTabAtom);
  const getMainEditorValue = useAtomValue(mainEditorValueAtom);
  const getInputEditorValue = useAtomValue(inputEditorValueAtom);
  const [judgeResults, setJudgeResults] = useJudgeResults();
  const setIsLineHighlightSet = useSetAtom(isLineHighlightSetAtom);
  const setSavedEditorValue = useSetAtom(savedEditorValue);
  const mainMonacoEditor = useAtomValue(mainMonacoEditorAtom);
  const loadedProblem = useAtomValue(problemAtom);
  const problemDataIsStale = fileData.problem
    ? loadedProblem?.platform !== fileData.problem.platform ||
      loadedProblem?.id !== fileData.problem.id
    : loadedProblem !== null;
  const problem = problemDataIsStale ? undefined : (loadedProblem ?? undefined);
  const serverTimeOffset = useServerTimeOffset();
  const isCodeRunActive = useCodeRunActive(fileData.codeRun);

  useUserFileConnection();
  const { pageTitle } = useUpdateUserDashboard();

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
  };

  const handleRunCode = () => {
    if (readOnly || isCodeRunActive || problemDataIsStale) {
      return;
    }

    const executeCode = (code: string, input: string): Promise<JudgeResult> => {
      return runCode({
        language: fileData.settings.language,
        code,
        input,
      });
    };

    const setResultAt = (index: number, data: JudgeResult | null) => {
      const newJudgeResults = judgeResults;
      while (newJudgeResults.length <= index) newJudgeResults.push(null);
      newJudgeResults[index] = data;
      setJudgeResults(newJudgeResults);
    };

    const runWithInput = async (
      input: string,
      expectedOutput?: string,
      prefix?: string
    ) => {
      if (!getMainEditorValue) {
        // editor is still loading
        return;
      }

      const runID = await beginCodeRun(fileData.id, serverTimeOffset);
      // There is already a run in progress, we shouldn't start another one.
      if (!runID) {
        return;
      }
      setResultAt(inputTabIndex, null);

      try {
        const code = getMainEditorValue();
        const data = await executeCode(code, input);
        cleanJudgeResult(data, expectedOutput, prefix);
        setResultAt(inputTabIndex, data);
      } catch (e) {
        setResultAt(inputTabIndex, runCodeErrorToResult(e));
        console.error(e);
      } finally {
        await endCodeRun(fileData.id, runID);
      }
    };

    const runAllList = ['judge', 'hints', 'solutions'];

    const runAllSamples = async () => {
      if (!problem || !getMainEditorValue) {
        // editor is still loading
        return;
      }
      const samples = problem.samples;

      const runID = await beginCodeRun(fileData.id, serverTimeOffset);
      // There is already a run in progress, we shouldn't start another one.
      if (!runID) {
        return;
      }
      setResultAt(1, null);

      try {
        const code = getMainEditorValue();
        const sampleResults = await runCodeBatch({
          language: fileData.settings.language,
          code,
          inputs: samples.map(sample => sample.input),
        });

        const newJudgeResults = judgeResults;
        const results: JudgeResult[] = [];

        let lastIndex = 0;
        for (let index = 0; index < samples.length; ++index) {
          const sample = samples[index];
          const data = sampleResults[index];
          if (data.status === 'internal_error') {
            console.error(data);
            throw new Error(data.message || JSON.stringify(data));
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
        const errorResult = runCodeErrorToResult(e);
        const newJudgeResults = judgeResults;
        runAllList.forEach((item, index) => {
          let tabIndex = tabsList.findIndex(tab => tab.value === item);
          if (tabIndex === -1) tabIndex = tabsList.length + index;
          newJudgeResults[tabIndex] = errorResult;
        });
        setJudgeResults(newJudgeResults);
        console.error(e);
      } finally {
        await endCodeRun(fileData.id, runID);
      }
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
      <PageTitle>{pageTitle}</PageTitle>
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 bg-[var(--panel-bg)] text-[color:var(--text-primary)]">
          <NavBar
            fileMenu={
              <FileMenu
                onOpenSettings={() => setIsWorkspaceSettingsModalOpen(true)}
              />
            }
            runButton={
              <RunButton
                onClick={handleRunCode}
                showLoading={isCodeRunActive || loading || problemDataIsStale}
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
          <HocuspocusProviderWebsocketComponent
            url={process.env.NEXT_PUBLIC_YJS_URL!}
          >
            <Workspace
              handleRunCode={handleRunCode}
              tabsList={tabsList}
              layoutResetKey={layoutResetKey}
            />
          </HocuspocusProviderWebsocketComponent>
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
        onResetLayout={() => setLayoutResetKey(key => key + 1)}
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
  const firebaseFileID = '-' + (queryId as string);
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
