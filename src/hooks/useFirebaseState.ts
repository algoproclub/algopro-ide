import {
  DatabaseReference,
  DataSnapshot,
  off,
  onValue,
  set,
} from 'firebase/database';
import { useEffect, useMemo, useState } from 'react';

export default function useFirebaseState<T>(
  ref: DatabaseReference | null | undefined,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    if (!ref) {
      setValue(defaultValue);
      return;
    }
    const callback = (snapshot: DataSnapshot) => {
      const val = snapshot.val();
      setValue(val ?? defaultValue);
    };
    onValue(ref, callback);
    return () => off(ref, 'value', callback);
  }, [ref?.key]);

  const update = useMemo(() => {
    if (!ref) return () => {};

    return (value: T) => {
      set(ref, value);
    };
  }, [ref]);

  return useMemo(() => [value, update], [value, update]);
}
