import { getDatabase, onValue, ref } from 'firebase/database';
import { useEffect, useState } from 'react';

export default function useServerTimeOffset(): number {
  const [serverTimeOffset, setServerTimeOffset] = useState(0);

  useEffect(() => {
    return onValue(ref(getDatabase(), '.info/serverTimeOffset'), snapshot => {
      const nextServerTimeOffset = snapshot.val();
      setServerTimeOffset(
        typeof nextServerTimeOffset === 'number' ? nextServerTimeOffset : 0
      );
    });
  }, []);

  return serverTimeOffset;
}
