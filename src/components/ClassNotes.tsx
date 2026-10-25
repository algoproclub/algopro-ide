import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import {
  HocuspocusContext,
  HocuspocusProviderWebsocketComponent,
  HocuspocusRoom,
  useHocuspocusConnectionStatus,
  useHocuspocusEvent,
  useHocuspocusProvider,
} from '@hocuspocus/provider-react';
import { getAuth } from 'firebase/auth';
import { DocumentDuplicateIcon } from '@heroicons/react/20/solid';
import toast from 'react-hot-toast';
import Markdown from './JudgeInterface/Markdown';
import { useUserContext } from '../context/UserContext';

const NotesEditor = dynamic(
  () => import('./editor/CodemirrorEditor/CodemirrorEditor'),
  { ssr: false }
);

const getToken = async () => getAuth().currentUser?.getIdToken() ?? '';

function NotesCodeBlock({ children }: { children?: ReactNode }) {
  const codeRef = useRef<HTMLPreElement>(null);
  return (
    <div className="my-3 overflow-hidden rounded-md border border-line bg-panel-muted">
      <div className="flex justify-end border-b border-line-muted px-2 py-1">
        <button
          type="button"
          className="ui-button-secondary text-xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                codeRef.current?.textContent ?? ''
              );
              toast.success('Code copied');
            } catch (error) {
              console.error('Could not copy class notes code.', error);
              toast.error('Could not copy code to the clipboard.');
            }
          }}
        >
          <DocumentDuplicateIcon className="h-4 w-4" aria-hidden="true" />
          Copy code
        </button>
      </div>
      <pre ref={codeRef} className="overflow-x-auto p-3 text-sm">
        {children}
      </pre>
    </div>
  );
}

const markdownComponents = { pre: NotesCodeBlock };

function NotesRoom({
  editable,
  disabled,
  onUnsyncedChanges,
}: {
  editable: boolean;
  disabled: boolean;
  onUnsyncedChanges?: (unsynced: boolean) => void;
}) {
  const provider = useHocuspocusProvider();
  const connectionStatus = useHocuspocusConnectionStatus();
  const [hasPendingEdits, setHasPendingEdits] = useState(false);
  const { userData } = useUserContext();
  const [error, setError] = useState<string | null>(null);
  const refreshAttempted = useRef(false);
  const [hasLoaded, setHasLoaded] = useState(provider.synced);
  const [isSynced, setIsSynced] = useState(provider.synced);
  const text = provider.document.getText('markdown');
  const subscribe = useCallback(
    (notify: () => void) => {
      text.observe(notify);
      return () => text.unobserve(notify);
    },
    [text]
  );
  // Y.Text is an external store: its observer also receives remote edits.
  const getSnapshot = useCallback(() => text.toString(), [text]); // eslint-disable-line @typescript-eslint/no-base-to-string -- Y.Text overrides toString().
  const markdown = useSyncExternalStore(subscribe, getSnapshot, () => '');
  const [writable, setWritable] = useState(
    provider.authorizedScope === 'read-write'
  );

  useHocuspocusEvent('authenticated', ({ scope }) => {
    refreshAttempted.current = false;
    setError(null);
    setWritable(scope === 'read-write');
  });
  useHocuspocusEvent('synced', ({ state }) => {
    setIsSynced(state);
    if (state) setHasLoaded(true);
  });
  useHocuspocusEvent('disconnect', () => setIsSynced(false));
  useHocuspocusEvent('close', () => {
    setIsSynced(false);
    setWritable(false);
    setError(
      'The class notes connection closed. Reconnect to continue receiving updates.'
    );
  });
  useHocuspocusEvent('unsyncedChanges', ({ number }) => {
    if (number === 0) setHasPendingEdits(false);
  });
  // eslint-disable-next-line react-hooks/immutability -- Hocuspocus exposes mutable connection state, not React state.
  useHocuspocusEvent('authenticationFailed', async ({ reason }) => {
    setIsSynced(false);
    setWritable(false);
    if (refreshAttempted.current) {
      console.error('Class notes authentication failed:', reason);
      setError(
        'Class notes could not be loaded. Check your access to this class and try again.'
      );
      return;
    }
    refreshAttempted.current = true;
    try {
      await getAuth().currentUser?.getIdToken(true);
      await provider.sendToken();
      // A token-fetch failure can leave the provider's previous sync flag set.
      // eslint-disable-next-line react-hooks/immutability -- Reset the external provider's handshake state before resyncing.
      provider.synced = false;
      provider.startSync();
    } catch (error) {
      console.error('Could not refresh class notes authentication.', error);
      setError('Could not connect to class notes. Please try again.');
    }
  });

  useEffect(() => {
    if (!editable) return;
    const observeEdits: Parameters<typeof text.observe>[0] = (
      _,
      transaction
    ) => {
      if (transaction.local) setHasPendingEdits(true);
    };
    text.observe(observeEdits);
    return () => text.unobserve(observeEdits);
  }, [editable, text]);

  useEffect(() => {
    onUnsyncedChanges?.(hasPendingEdits);
    return () => onUnsyncedChanges?.(false);
  }, [hasPendingEdits, onUnsyncedChanges]);

  useEffect(() => {
    if (!editable) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingEdits) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [editable, hasPendingEdits]);

  const ready = connectionStatus === 'connected' && isSynced && !error;
  return (
    <div className="flex h-full min-h-0 flex-col text-content">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2 text-xs text-content-muted">
        <span>
          {editable
            ? 'Markdown · Changes are saved automatically and shown to students immediately.'
            : 'Shared by your teachers · Updates live.'}
        </span>
        <span role="status">
          {error
            ? 'Connection failed'
            : connectionStatus !== 'connected'
              ? hasPendingEdits
                ? 'Disconnected — changes not saved'
                : 'Connecting…'
              : !isSynced
                ? 'Loading…'
                : editable && hasPendingEdits
                  ? 'Saving…'
                  : editable
                    ? 'All changes synced'
                    : 'Connected'}
        </span>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 border-b border-line p-4 text-sm text-danger"
        >
          <p>{error}</p>
          <button
            type="button"
            className="ui-button-secondary"
            onClick={() => {
              refreshAttempted.current = false;
              setIsSynced(false);
              setError(null);
              void provider
                .sendToken()
                .then(() => {
                  provider.synced = false;
                  provider.startSync();
                })
                .catch(() => {
                  setError(
                    'Could not reconnect to class notes. Please try again.'
                  );
                });
            }}
          >
            Retry
          </button>
        </div>
      )}
      {!hasLoaded ? (
        !error && (
          <p className="p-4 text-sm text-content-muted">Loading class notes…</p>
        )
      ) : (
        <div
          className={
            editable
              ? 'grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2'
              : 'min-h-0 flex-1 overflow-y-auto'
          }
        >
          {editable && (
            <div className="flex min-h-0 flex-col border-b border-line md:border-b-0 md:border-r">
              <h3 className="m-0 px-4 py-2 text-sm font-semibold">
                Markdown source
              </h3>
              <div className="tw-forms-disable tw-forms-disable-all-descendants h-80 min-h-0 flex-1">
                <NotesEditor
                  language="plaintext"
                  theme={userData?.lightMode ? 'light' : 'dark'}
                  editorOptions={{
                    readOnly: disabled || !ready || !writable,
                    tabSize: userData?.tabSize ?? 4,
                    fontSize: userData?.fontSize,
                  }}
                  yjsInfo={{
                    documentId: provider.configuration.name,
                    yjsText: text,
                    yjsAwareness: provider.awareness!,
                  }}
                />
              </div>
            </div>
          )}
          <div className="min-h-0 overflow-y-auto p-4">
            {editable && (
              <h3 className="m-0 mb-3 text-sm font-semibold">
                Student preview
              </h3>
            )}
            {markdown.trim() ? (
              <div className="break-words text-sm leading-6 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-accent [&_a]:underline [&_a]:decoration-accent [&_a]:underline-offset-2 [&_a:hover]:text-accent-hover [&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-4 [&_blockquote]:text-content-secondary [&_hr]:my-4 [&_hr]:border-line [&_img]:max-w-full [&_code]:font-mono">
                <Markdown skipHtml components={markdownComponents}>
                  {markdown}
                </Markdown>
              </div>
            ) : (
              <p className="text-sm text-content-muted">
                {editable
                  ? 'Write notes, code snippets, or a summary in Markdown. Students will see them here.'
                  : 'Your teachers have not added any notes for this class yet.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClassNotes({
  groupID,
  classID,
  creationTime,
  editable = false,
  disabled = false,
  onUnsyncedChanges,
}: {
  groupID: string;
  classID: string;
  creationTime: number;
  editable?: boolean;
  disabled?: boolean;
  onUnsyncedChanges?: (unsynced: boolean) => void;
}) {
  const websocketContext = useContext(HocuspocusContext);
  const name = `class-notes:${encodeURIComponent(groupID)}:${encodeURIComponent(classID)}:${creationTime}`;
  const room = (
    <HocuspocusRoom key={name} name={name} token={getToken}>
      <NotesRoom
        editable={editable}
        disabled={disabled}
        onUnsyncedChanges={onUnsyncedChanges}
      />
    </HocuspocusRoom>
  );
  // The workspace already has a shared socket; the class editor does not.
  return websocketContext ? (
    room
  ) : (
    <HocuspocusProviderWebsocketComponent
      url={process.env.NEXT_PUBLIC_YJS_URL!}
    >
      {room}
    </HocuspocusProviderWebsocketComponent>
  );
}
