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
  mobileActiveTabAtom,
  problemAtom,
  showSidebarAtom,
} from '../src/atoms/workspaceUI';
import React, { type ReactNode, useEffect, useState } from 'react';
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
import ConfirmOverrideModal from '../src/components/ConfirmOverrideModal';
import Link from 'next/link';
import ProfileSettings from '../src/components/settings/ProfileSettings';
import WithRegistration from '../src/components/WithRegistration';
import { beginCodeRun, endCodeRun } from '../src/scripts/codeRun';
import useCodeRunActive from '../src/hooks/useCodeRunActive';
import useServerTimeOffset from '../src/hooks/useServerTimeOffset';
import { HocuspocusProviderWebsocketComponent } from '@hocuspocus/provider-react';
import PageTitle from '../src/components/PageTitle';
import {
  getClassContext,
  getTaskRef,
  type ClassContext,
} from '../src/scripts/getTaskRef';
import { WorkspaceLaunchProvider } from '../src/context/WorkspaceLaunchContext';
import ProblemDataLoader from '../src/components/Workspace/ProblemDataLoader';

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
  const {
    sampleResults: storedSampleResults,
    setInputResult,
    setSampleResults,
  } = useJudgeResults();
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

  const inputTab = useAtomValue(inputTabAtom);

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

    const setActiveResult = (result: JudgeResult | null) => {
      if (inputTab === 'input') {
        return setInputResult(result);
      }

      const sampleIndex = getSampleIndex(inputTab) - 1;
      const nextResults = Array.from(
        { length: Math.max(storedSampleResults.length, sampleIndex + 1) },
        (_, index) => storedSampleResults[index] ?? null
      );
      nextResults[sampleIndex] = result;
      return setSampleResults(nextResults);
    };

    const runWithInput = async (input: string, expectedOutput?: string) => {
      if (!getMainEditorValue) {
        // editor is still loading
        return;
      }

      const runID = await beginCodeRun(fileData.id, serverTimeOffset);
      // There is already a run in progress, we shouldn't start another one.
      if (!runID) {
        return;
      }
      await setActiveResult(null);

      try {
        const code = getMainEditorValue();
        const data = await executeCode(code, input);
        cleanJudgeResult(data, expectedOutput);
        await setActiveResult(data);
      } catch (e) {
        const errorResult = runCodeErrorToResult(e);
        await setActiveResult(errorResult);
        console.error(e);
      } finally {
        await endCodeRun(fileData.id, runID);
      }
    };

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
      await setSampleResults([]);

      try {
        const code = getMainEditorValue();
        const sampleResults = await runCodeBatch({
          language: fileData.settings.language,
          code,
          inputs: samples.map(sample => sample.input),
        });

        for (let index = 0; index < samples.length; ++index) {
          const sample = samples[index];
          const data = sampleResults[index];
          if (data.status === 'internal_error') {
            console.error(data);
          }
          cleanJudgeResult(data, sample.output);
        }
        await setSampleResults(sampleResults);
      } catch (e) {
        const errorResult = runCodeErrorToResult(e);
        await setSampleResults(samples.map(() => errorResult));
        console.error(e);
      } finally {
        await endCodeRun(fileData.id, runID);
      }
    };

    setSavedEditorValue(getMainEditorValue ? getMainEditorValue() : null);

    if (inputTab === 'input') {
      if (getInputEditorValue) runWithInput(getInputEditorValue());
    } else if (['judge', 'hints', 'solutions'].includes(inputTab)) {
      runAllSamples();
    } else {
      const samples = problem?.samples;
      if (samples) {
        const index = getSampleIndex(inputTab);
        const sample = samples[index - 1];
        runWithInput(sample.input, sample.output);
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
        <div className="flex-shrink-0 bg-panel text-content">
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
          <Workspace
            handleRunCode={handleRunCode}
            layoutResetKey={layoutResetKey}
          />
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

function WorkspaceLaunchBoundary({
  children,
  classContext,
  fileID,
  userID,
}: {
  children: ReactNode;
  classContext: ClassContext | null;
  fileID: string;
  userID: string;
}) {
  const router = useRouter();
  const { fileData } = useEditorContext();
  const ownsFile = fileData.users[userID]?.permission === 'OWNER';

  useEffect(() => {
    if (classContext && !ownsFile) {
      void router.replace(getTaskRef({ id: fileID }), undefined, {
        shallow: true,
      });
    }
  }, [classContext, fileID, ownsFile, router]);

  return (
    <WorkspaceLaunchProvider classContext={ownsFile ? classContext : null}>
      {children}
    </WorkspaceLaunchProvider>
  );
}

function PageContent() {
  const router = useRouter();
  const queryId = router.query.id;
  const firebaseFileID = '-' + (queryId as string);
  const { firebaseUser, userData, registered } = useNullableUserContext();
  const classContext = router.isReady
    ? getClassContext(router.query.group, router.query.class)
    : null;

  const loadingUI = <MessagePage message="Loading…" showHomeButton={false} />;
  const fileNotFoundUI = (
    <div className="p-8 sm:p-16">
      <div className="max-w-prose mx-auto">
        <div className="text-3xl font-bold text-content sm:text-4xl">
          File Not Found
        </div>
        <p className="mx-auto mt-3 max-w-prose text-left text-content-secondary sm:text-lg">
          Please check that the entered file ID is correct.
        </p>
        <Link
          href="/"
          className="ui-button-primary mt-4 px-4 py-2 text-base sm:mt-6"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
  const permissionDeniedUI = <MessagePage message="This file is private." />;

  if (!queryId) return null;

  return (
    <EditorProvider
      fileId={firebaseFileID}
      loadingUI={loadingUI}
      fileNotFoundUI={fileNotFoundUI}
      permissionDeniedUI={permissionDeniedUI}
    >
      <WorkspaceLaunchBoundary
        classContext={classContext}
        fileID={queryId as string}
        userID={firebaseUser!.uid}
      >
        <ProblemDataLoader>
          {userData && registered ? <EditorPage /> : loadingUI}
        </ProblemDataLoader>
        <ConfirmOverrideModal />
      </WorkspaceLaunchBoundary>
    </EditorProvider>
  );
}

export default function FilePage() {
  return (
    <WithRegistration>
      <HocuspocusProviderWebsocketComponent
        url={process.env.NEXT_PUBLIC_YJS_URL!}
      >
        <PageContent />
      </HocuspocusProviderWebsocketComponent>
    </WithRegistration>
  );
}
