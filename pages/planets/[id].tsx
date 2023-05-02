import React, { useEffect, useRef, useState } from 'react';

import { useAtomValue } from 'jotai/utils';

import { useRouter } from 'next/router';
import invariant from 'tiny-invariant';
import { MessagePage } from '../../src/components/MessagePage';
import { useNullableUserContext } from '../../src/context/UserContext';

export default function CreatePlanets(): JSX.Element {
  const router = useRouter();

  const { firebaseUser, userData } = useNullableUserContext();
  const [error, setError] = useState<string | null>(null);

  const createdRef = useRef<boolean>(false);

  useEffect(() => {
    if (!router.isReady || !firebaseUser || !userData || createdRef.current)
      return;
    const planetsProblemID = router.query.id;
    createdRef.current = true;

    invariant(
      typeof planetsProblemID === 'string',
      'Expected Planets Problem ID to be a string'
    );

    (async () => {
      const resp = await fetch(`/api/createPlanetsFile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planetsProblemID: planetsProblemID,
          userID: firebaseUser.uid,
          userName: firebaseUser.displayName,
          defaultPermission: userData.defaultPermission,
        }),
      });
      if (resp.status === 500) {
        setError('An unknown error occurred.');
      } else {
        const data = await resp.json();
        if (data.message) {
          // error
          setError(data.message);
        } else {
          router.replace(`/${data.fileID}`);
        }
      }
    })();
  }, [router.isReady, firebaseUser, userData]);

  if (error) {
    return <MessagePage message={'Error: ' + error} />;
  }

  return <MessagePage message="Loading File..." showHomeButton={false} />;
}
