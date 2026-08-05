import { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  problemLibraryIsStaleAtom,
  syncProblemLibraryAtom,
} from '../atoms/problemLibrary';
import RefreshButton from './RefreshButton';

export default function ProblemLibraryRefreshButton() {
  const isStale = useAtomValue(problemLibraryIsStaleAtom);
  const sync = useSetAtom(syncProblemLibraryAtom);
  const [isSyncing, setIsSyncing] = useState(false);

  return (
    <RefreshButton
      title={
        isStale
          ? 'New task metadata available. Sync problem library.'
          : 'Sync problem library'
      }
      isLoading={isSyncing}
      isAlert={isStale}
      onClick={async () => {
        setIsSyncing(true);
        try {
          await sync();
        } catch {
          alert('The problem library could not be synced.');
        } finally {
          setIsSyncing(false);
        }
      }}
    />
  );
}
