import {
  DatabaseReference,
  DataSnapshot,
  off,
  onValue,
} from 'firebase/database';
import { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';

export default function useFirebaseRefValue<T>(
  ref: DatabaseReference | undefined
) {
  const [value, setValue] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!ref) {
      setIsLoading(false);
      setValue(null);
      return;
    }
    setIsLoading(true);
    setValue(null);

    const callback = (snapshot: DataSnapshot) => {
      ReactDOM.unstable_batchedUpdates(() => {
        setIsLoading(false);
        setValue(snapshot.val());
      });
    };
    onValue(ref, callback);

    return () => off(ref, 'value', callback);
  }, [ref?.key]);

  return useMemo(
    () => ({
      value,
      isLoading,
    }),
    [value, isLoading]
  );
}
