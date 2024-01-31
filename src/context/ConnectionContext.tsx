import {
  createContext,
  MutableRefObject,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import invariant from 'tiny-invariant';
import {
  ref,
  getDatabase,
  onValue,
  onDisconnect,
  off,
  DatabaseReference,
  DataSnapshot,
  set,
  remove,
} from 'firebase/database';
import { useUpdateAtom } from 'jotai/utils';

export type ConnectionContextType = {
  addConnectionRef: (ref: DatabaseReference) => void;
  removeConnectionRef: (ref: DatabaseReference) => void;
  getConnectionRefs: () => DatabaseReference[]; // used for firebase sign in
  clearConnectionRefs: () => void;
};

const ConnectionContext = createContext<ConnectionContextType | undefined>(
  undefined
);

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const isConnectedRef = useRef<boolean>(false);
  const connectionRefs = useRef<DatabaseReference[]>([]);
  const setFirebaseError = (e: any) =>
    alert('Error in ConnectionContext.tsx: ' + e?.message);

  const setRef = (ref: DatabaseReference) => {
    onDisconnect(ref).remove();
    set(ref, true);
  };

  useEffect(() => {
    const handleConnectionChange = (snap: DataSnapshot) => {
      if (snap.val() === true) {
        isConnectedRef.current = true;
        connectionRefs.current.forEach(setRef);
      } else {
        isConnectedRef.current = false;
      }
    };
    const connectedRef = ref(getDatabase(), '.info/connected');
    onValue(connectedRef, handleConnectionChange, e => setFirebaseError(e));
    return () => off(connectedRef, 'value', handleConnectionChange);
  }, []);

  const contextValue = useMemo(() => {
    return {
      addConnectionRef: (ref: DatabaseReference) => {
        if (isConnectedRef.current) setRef(ref);
        connectionRefs.current.push(ref);
      },
      removeConnectionRef: (ref: DatabaseReference) => {
        remove(ref);
        connectionRefs.current = connectionRefs.current.filter(
          x => !x.isEqual(ref)
        );
      },
      getConnectionRefs: () => {
        return connectionRefs.current;
      },
      clearConnectionRefs: () => {
        connectionRefs.current.forEach(x => remove(x));
        connectionRefs.current = [];
      },
    };
  }, []);
  return (
    <ConnectionContext.Provider value={contextValue}>
      {children}
    </ConnectionContext.Provider>
  );
};

export function useConnectionContext() {
  const context = useContext(ConnectionContext);
  invariant(
    !!context,
    "Can't call useConnectionContext() outside of a ConnectionProvider"
  );
  return context;
}
