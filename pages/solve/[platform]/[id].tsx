import { useRouter } from 'next/router';
import { MessagePage } from '../../../src/components/MessagePage';
import WithRegistration from '../../../src/components/WithRegistration';
import { useNullableUserContext } from '../../../src/context/UserContext';
import React, { useEffect, useRef, useState } from 'react';
import invariant from 'tiny-invariant';
import va from '@vercel/analytics';

function PageContent(): JSX.Element {
  const router = useRouter();

  const { firebaseUser, userData, logged } = useNullableUserContext();
  const [error, setError] = useState<string | null>(null);

  const loginUI = (
    <MessagePage
      message="Please login to solve this task."
      showHomeButton={true}
    />
  );
  const loadingUI = <MessagePage message="Loading..." showHomeButton={false} />;

  const createdRef = useRef<boolean>(false);

  useEffect(() => {
    if (!router.isReady || !firebaseUser || !userData || createdRef.current)
      return;
    const platform = router.query.platform;
    const problemID = router.query.id;
    const tournamentID = router.query.tournamentID;
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
        },
        body: JSON.stringify({
          platform: platform,
          problemID: problemID,
          tournamentID,
          userID: firebaseUser.uid,
          userName: firebaseUser.displayName,
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
          router.replace(`/${data.fileID.substring(1)}`);
        }
      }
    })();
  }, [router.isReady, firebaseUser, userData]);

  if (error) {
    return <MessagePage message={'Error: ' + error} />;
  }

  if (logged === false) return loginUI;
  return loadingUI;
}

export default function CreatePlatformFile() {
  return (
    <WithRegistration>
      <PageContent />
    </WithRegistration>
  );
}
