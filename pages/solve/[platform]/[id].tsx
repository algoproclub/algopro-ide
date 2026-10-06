import { useRouter } from 'next/router';
import { MessagePage } from '../../../src/components/MessagePage';
import WithRegistration from '../../../src/components/WithRegistration';
import { useNullableUserContext } from '../../../src/context/UserContext';
import React, { useEffect, useRef, useState } from 'react';
import invariant from 'tiny-invariant';
import va from '@vercel/analytics';
import { getClassContext, getTaskRef } from '../../../src/scripts/getTaskRef';

function PageContent(): JSX.Element {
  const router = useRouter();

  const { firebaseUser, userData } = useNullableUserContext();
  const [error, setError] = useState<string | null>(null);

  const loadingUI = <MessagePage message="Loading…" showHomeButton={false} />;

  const createdRef = useRef<boolean>(false);

  useEffect(() => {
    if (!router.isReady || !firebaseUser || !userData || createdRef.current)
      return;
    const platform = router.query.platform;
    const problemID = router.query.id;
    const tournamentID = router.query.tournamentID;
    const classContext = getClassContext(
      router.query.group,
      router.query.class
    );
    createdRef.current = true;

    invariant(
      typeof problemID === 'string',
      'Expected problem ID to be a string'
    );

    (async () => {
      va.track('Create File', { type: 'platform-file' });

      const resp = await fetch(`/api/createNewPlatformFile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
        },
        body: JSON.stringify({
          platform,
          problemID,
          tournamentID,
          language: userData.defaultLanguage,
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
          const fileID = data.fileID.substring(1);
          router.replace(getTaskRef({ id: fileID }, classContext ?? undefined));
        }
      }
    })();
  }, [router, firebaseUser, userData]);

  if (error) {
    return <MessagePage message={'Error: ' + error} />;
  }

  return loadingUI;
}

export default function CreatePlatformFile() {
  return (
    <WithRegistration waitForUserData>
      <PageContent />
    </WithRegistration>
  );
}
