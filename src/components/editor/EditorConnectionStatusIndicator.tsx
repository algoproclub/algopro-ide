import { useEffect, useState } from 'react';

const SYNC_INDICATOR_DELAY_MS = 100;

type EditorSyncStatus = 'initializing' | 'syncing' | 'synced';

function useDelayedSyncIndicator(syncStatus: EditorSyncStatus) {
  const [delayElapsed, setDelayElapsed] = useState(false);
  const isSyncing = syncStatus === 'syncing';

  useEffect(() => {
    if (!isSyncing) {
      // Reset the delay for the next batch of changes. The returned value is
      // gated below, so the sync status disappears immediately in this render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDelayElapsed(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setDelayElapsed(true);
    }, SYNC_INDICATOR_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isSyncing]);

  return isSyncing && delayElapsed;
}

export default function EditorConnectionStatusIndicator({
  connectionStatus,
  syncStatus,
}: {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  syncStatus: EditorSyncStatus;
}) {
  const isSyncing = syncStatus === 'syncing';
  const showSyncIndicator = useDelayedSyncIndicator(syncStatus);
  let connectionText: string;
  let statusIndicatorClass: string;

  switch (connectionStatus) {
    case 'connected':
      if (syncStatus === 'initializing' || showSyncIndicator) {
        connectionText = 'Synchronizing...';
        statusIndicatorClass = 'bg-yellow-500';
      } else {
        connectionText = 'Connected';
        statusIndicatorClass = 'bg-green-500';
      }
      break;
    case 'connecting':
      connectionText = isSyncing ? 'Reconnecting to save...' : 'Connecting...';
      statusIndicatorClass = 'bg-yellow-500';
      break;
    case 'disconnected':
      connectionText = isSyncing
        ? 'Disconnected — changes not saved'
        : 'Disconnected';
      statusIndicatorClass = 'bg-red-500';
      break;
  }

  return (
    <div className="absolute z-10 bg-[var(--panel-bg-alt)] text-[color:var(--text-primary)] border border-[var(--border-color)] rounded-md py-1.5 px-2 right-[1.25rem] top-[0.25rem] flex items-center opacity-90 hover:opacity-0 transition">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${statusIndicatorClass}`}
      ></span>
      <span className="text-xs">{connectionText}</span>
    </div>
  );
}
