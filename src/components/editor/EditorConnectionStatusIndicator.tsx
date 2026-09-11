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
        connectionText = 'Synchronizing…';
        statusIndicatorClass = 'bg-status-warning';
      } else {
        connectionText = 'Connected';
        statusIndicatorClass = 'bg-status-success';
      }
      break;
    case 'connecting':
      connectionText = isSyncing ? 'Reconnecting to save…' : 'Connecting…';
      statusIndicatorClass = 'bg-status-warning';
      break;
    case 'disconnected':
      connectionText = isSyncing
        ? 'Disconnected — changes not saved'
        : 'Disconnected';
      statusIndicatorClass = 'bg-status-danger';
      break;
  }

  return (
    <div className="absolute right-3 top-2 z-10 flex items-center rounded-full border border-line-strong bg-surface-raised px-2.5 py-1 text-content shadow-md transition-opacity hover:opacity-0">
      <span
        className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${statusIndicatorClass}`}
      ></span>
      <span className="text-xs font-medium">{connectionText}</span>
    </div>
  );
}
