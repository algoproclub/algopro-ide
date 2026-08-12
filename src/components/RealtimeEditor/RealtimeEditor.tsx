import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAtom } from 'jotai';
import {
  HocuspocusRoom,
  useHocuspocusConnectionStatus,
  useHocuspocusEvent,
  useHocuspocusProvider,
  useHocuspocusSyncStatus,
} from '@hocuspocus/provider-react';
import { getAuth } from 'firebase/auth';
import { loadingAtom } from '../../atoms/workspace';
import { EditorProps, EditorYjsInfo } from '../editor/editor-types';
import EditorConnectionStatusIndicator from '../editor/EditorConnectionStatusIndicator';
import colorFromUserId, {
  bgColorFromUserId,
} from '../../scripts/colorFromUserId';
import { useUserContext } from '../../context/UserContext';
import { useEditorContext } from '../../context/EditorContext';
import { CodeEditor } from '../editor/CodeEditor';
import '../../styles/yjs.css';

const AUTHENTICATION_FAILURE_WINDOW_MS = 30_000;

export interface RealtimeEditorProps extends EditorProps {
  defaultValue?: string;
  yjsDocumentId: string;
  useEditorWithVim?: boolean;
  dataTestId?: string;
}

const RealtimeEditorRoom = ({
  defaultValue,
  yjsDocumentId,
  useEditorWithVim = false,
  dataTestId = '',
  ...props
}: RealtimeEditorProps): JSX.Element => {
  const provider = useHocuspocusProvider();
  const connectionStatus = useHocuspocusConnectionStatus();
  const providerSyncStatus = useHocuspocusSyncStatus();
  const { doNotInitializeTheseFileIdsRef } = useEditorContext();
  const { userData, firebaseUser } = useUserContext();
  const [, setLoading] = useAtom(loadingAtom);
  const { editorMode: mode } = userData;
  const [yjsInfo, setYjsInfo] = useState<EditorYjsInfo | null>(null);
  const [isRoomReady, setIsRoomReady] = useState(provider.synced);
  const authenticationFailureWindowStartRef = useRef<number | null>(null);
  const authenticationRetryBlockedRef = useRef(false);
  const path = props.path;
  const editorOptionsProp = props.editorOptions;
  const isProviderOnActiveDocument =
    provider.configuration.name === yjsDocumentId;

  useEffect(() => {
    authenticationFailureWindowStartRef.current = null;
    authenticationRetryBlockedRef.current = false;
  }, [provider]);

  useHocuspocusEvent('authenticationFailed', async ({ reason }) => {
    const now = Date.now();
    const failureWindowStart = authenticationFailureWindowStartRef.current;
    const failedAgainWithinWindow =
      failureWindowStart !== null &&
      now - failureWindowStart < AUTHENTICATION_FAILURE_WINDOW_MS;

    if (authenticationRetryBlockedRef.current || failedAgainWithinWindow) {
      authenticationRetryBlockedRef.current = true;
      console.error('YJS authentication failed', reason);
      return;
    }

    authenticationFailureWindowStartRef.current = now;
    console.log('Will refresh Firebase token for YJS');
    // If Hocuspocus rejects an expired Firebase token, force a refresh and
    // resend auth on the existing provider to avoid remounting the editor.
    try {
      await firebaseUser.getIdToken(true);
      await provider.sendToken();
      provider.startSync();
    } catch (error) {
      console.error('Failed to refresh Firebase token for YJS', error);
    }
  });

  useHocuspocusEvent('authenticated', () => {
    authenticationFailureWindowStartRef.current = null;
    authenticationRetryBlockedRef.current = false;
  });

  useHocuspocusEvent('close', () => {
    setIsRoomReady(false);
  });

  useHocuspocusEvent('disconnect', () => {
    setIsRoomReady(false);
  });

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!provider.hasUnsyncedChanges) return;

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [provider]);

  useEffect(() => {
    const awareness = provider.awareness;
    if (!awareness) return;

    awareness.setLocalStateField('firebaseUserID', firebaseUser.uid);
  }, [firebaseUser, provider.awareness]);

  useEffect(() => {
    // Clear stale bindings while switching rooms; they will be reattached once
    // the provider points to the new document and sync completes.
    setYjsInfo(null);
    setIsRoomReady(false);
  }, [yjsDocumentId]);

  useEffect(() => {
    const documentId = yjsDocumentId;
    if (!isProviderOnActiveDocument) return;

    const awareness = provider.awareness;
    if (!awareness) return;

    const monacoText = provider.document.getText('monaco');
    setYjsInfo({
      documentId,
      path,
      yjsText: monacoText,
      yjsAwareness: awareness,
    });

    return () => {
      setYjsInfo(currentYjsInfo =>
        currentYjsInfo?.documentId === documentId ? null : currentYjsInfo
      );
    };
  }, [
    isProviderOnActiveDocument,
    path,
    provider.awareness,
    provider.document,
    yjsDocumentId,
  ]);

  useEffect(() => {
    const affectsLoading =
      path && ['myfile.cpp', 'myfile.java', 'myfile.py'].includes(path);
    if (affectsLoading) setLoading(true);

    const handleAwarenessChange = ({ added }: { added: Array<number> }) => {
      if (added.length === 0) return;

      type UserAwarenessData = Map<
        number,
        {
          firebaseUserID: string;
        }
      >;

      const awareness = provider.awareness;
      if (!awareness) return;

      const awarenessState = awareness.getStates() as UserAwarenessData;
      for (const addedUserID of added) {
        const firebaseUserID =
          awarenessState.get(addedUserID)?.firebaseUserID ??
          '-NPeGgrWL0zpVHHZ2aECh';
        const styleToAdd = `.yRemoteSelection-${addedUserID}, .yRemoteSelectionHead-${addedUserID} {
              --yjs-selection-color-bg: ${bgColorFromUserId(firebaseUserID)};
              --yjs-selection-color: ${colorFromUserId(firebaseUserID)};
            }`;
        document.body.insertAdjacentHTML(
          'beforeend',
          `<style>${styleToAdd}</style>`
        );
      }
    };

    const awareness = provider.awareness;
    if (!awareness) return;

    awareness.on('change', handleAwarenessChange);

    return () => {
      awareness.off('change', handleAwarenessChange);
    };
  }, [path, provider.awareness, setLoading]);

  const initializeDocumentIfNeeded = useCallback(() => {
    if (!provider.synced || !isProviderOnActiveDocument) return;

    const documentId = yjsDocumentId;

    if (!doNotInitializeTheseFileIdsRef.current[documentId]) {
      const isInitializedMap = provider.document.getMap('isInitialized');
      const monacoText = provider.document.getText('monaco');

      if (!isInitializedMap.get('isInitialized')) {
        isInitializedMap.set('isInitialized', true);
        if (monacoText.length === 0 && defaultValue) {
          monacoText.insert(0, defaultValue);
        }
      }

      doNotInitializeTheseFileIdsRef.current[documentId] = true;

      if (
        yjsDocumentId.endsWith('cpp') ||
        yjsDocumentId.endsWith('java') ||
        yjsDocumentId.endsWith('py')
      ) {
        const prefix = yjsDocumentId.substring(
          0,
          yjsDocumentId.lastIndexOf('.')
        );
        doNotInitializeTheseFileIdsRef.current[prefix + '.cpp'] = true;
        doNotInitializeTheseFileIdsRef.current[prefix + '.java'] = true;
        doNotInitializeTheseFileIdsRef.current[prefix + '.py'] = true;
      }
    }

    setIsRoomReady(true);
    setLoading(false);
  }, [
    defaultValue,
    doNotInitializeTheseFileIdsRef,
    isProviderOnActiveDocument,
    provider,
    setLoading,
    yjsDocumentId,
  ]);

  useEffect(() => {
    if (!isProviderOnActiveDocument) {
      setIsRoomReady(false);
      return;
    }

    setIsRoomReady(provider.synced);
    if (provider.synced) {
      initializeDocumentIfNeeded();
      return;
    }

    const handleSynced = () => {
      initializeDocumentIfNeeded();
    };

    provider.on('synced', handleSynced);
    return () => {
      provider.off('synced', handleSynced);
    };
  }, [
    initializeDocumentIfNeeded,
    isProviderOnActiveDocument,
    provider,
    yjsDocumentId,
  ]);

  const isEditorReady =
    isProviderOnActiveDocument &&
    connectionStatus === 'connected' &&
    isRoomReady &&
    provider.synced;
  const editorSyncStatus =
    connectionStatus === 'connected' && !isEditorReady
      ? 'initializing'
      : providerSyncStatus;

  // Keep the editor read only until its room is connected and ready.
  const editorOptions = useMemo(() => {
    const nextEditorOptions = { ...(editorOptionsProp || {}) };
    if (!isEditorReady) nextEditorOptions.readOnly = true;
    return nextEditorOptions;
  }, [editorOptionsProp, isEditorReady]);

  const activeYjsInfo = useMemo(() => {
    if (!yjsInfo) {
      return null;
    }

    if (yjsInfo.documentId !== yjsDocumentId) {
      return null;
    }

    if (yjsInfo.path !== path) {
      return null;
    }

    return yjsInfo;
  }, [path, yjsDocumentId, yjsInfo]);

  return (
    <div
      className="tw-forms-disable tw-forms-disable-all-descendants h-full relative"
      // ugh this should really be data-testid
      data-test-id={dataTestId}
    >
      <EditorConnectionStatusIndicator
        connectionStatus={connectionStatus}
        syncStatus={editorSyncStatus}
      />
      <CodeEditor
        {...props}
        editorOptions={editorOptions}
        yjsInfo={activeYjsInfo}
        vim={useEditorWithVim && mode === 'Vim'}
      />
    </div>
  );
};

const RealtimeEditor = ({
  yjsDocumentId,
  ...props
}: RealtimeEditorProps): JSX.Element => {
  const getToken = useCallback(async () => {
    const currentUser = getAuth().currentUser;
    // Let Firebase hand us a fresh ID token on demand instead of caching one in
    // component state. getIdToken() refreshes automatically when the current
    // token is close to expiring.
    return currentUser ? currentUser.getIdToken() : '';
  }, []);

  return (
    <HocuspocusRoom name={yjsDocumentId} token={getToken}>
      <RealtimeEditorRoom {...props} yjsDocumentId={yjsDocumentId} />
    </HocuspocusRoom>
  );
};

export default RealtimeEditor;
