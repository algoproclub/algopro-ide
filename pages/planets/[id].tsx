import React, { useEffect, useState } from 'react';
import { useAtomValue, useUpdateAtom } from 'jotai/utils';
import {
  firebaseUserAtom,
  signInWithGoogleAtom,
} from '../../src/atoms/firebaseUserAtoms';
import { useConnectionContext } from '../../src/context/ConnectionContext';
import { useRouter } from 'next/router';
import invariant from 'tiny-invariant';
import { MessagePage } from '../../src/components/MessagePage';
import {
  userSettingsAtomWithPersistence,
  isUserSettingsLoadingAtom,
  displayNameAtom,
} from '../../src/atoms/userSettings';

export default function CreatePlanets(): JSX.Element {
  const router = useRouter();

  const signInWithGoogle = useUpdateAtom(signInWithGoogleAtom);
  const connectionContext = useConnectionContext();
  const firebaseUser = useAtomValue(firebaseUserAtom);
  const userSettings = useAtomValue(userSettingsAtomWithPersistence);
  const isUserSettingsLoading = useAtomValue(isUserSettingsLoadingAtom);
  const displayName = useAtomValue(displayNameAtom);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !router.isReady ||
      !firebaseUser ||
      isUserSettingsLoading ||
      !displayName
    )
      return;
    const planetsProblemID = router.query.id;

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
          userName: displayName,
          defaultPermission: userSettings.defaultPermission,
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
  }, [router.isReady, firebaseUser, isUserSettingsLoading, displayName]);

  if (error) {
    return <MessagePage message={'Error: ' + error} />;
  }

  if (!firebaseUser) {
    return (
      <div className="p-4 sm:p-6 md:p-8 lg:p-12 min-h-full flex flex-col max-w-6xl mx-auto">
        <div className="flex-1">
          <div className="text-gray-400 mt-6">
            Not signed in to the development environment.{' '}
            <button
              className="underline text-gray-200 focus:outline-none hover:bg-gray-700 p-1 leading-none transition"
              onClick={() => signInWithGoogle(connectionContext)}
            >
              Sign in now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <MessagePage message="Loading File..." showHomeButton={false} />;
}
