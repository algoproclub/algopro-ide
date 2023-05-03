import React, { useEffect } from 'react';
import { ConfirmOverrideModal } from '../src/components/ConfirmOverrideModal';
import { useAtomValue, useUpdateAtom } from 'jotai/utils';
import {
  firebaseUserAtom,
  signInWithGoogleAtom,
} from '../src/atoms/firebaseUserAtoms';
import { isUserSettingsLoadingAtom } from '../src/atoms/userSettings';
import Dashboard from '../src/components/Dashboard/Dashboard';
import { useConnectionContext } from '../src/context/ConnectionContext';

export default function DashboardPage(): JSX.Element {
  const signInWithGoogle = useUpdateAtom(signInWithGoogleAtom);
  const connectionContext = useConnectionContext();
  const firebaseUser = useAtomValue(firebaseUserAtom);
  const isUserSettingsLoading = useAtomValue(isUserSettingsLoadingAtom);

  useEffect(() => {
    document.title = 'Real-Time Collaborative Online IDE';
  }, []);

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-12 min-h-full flex flex-col max-w-6xl mx-auto">
      <ConfirmOverrideModal />
      <div className="flex-1">
        <h1 className="text-gray-100 text-2xl md:text-4xl font-black">
          Real-Time Collaborative Online IDE
        </h1>

        <div className="h-6"></div>

        {!firebaseUser ? (
          <div className="text-gray-400 mt-6">
            Not signed in.{' '}
            <button
              className="underline text-gray-200 focus:outline-none hover:bg-gray-700 p-1 leading-none transition"
              onClick={() => signInWithGoogle(connectionContext)}
            >
              Sign in now
            </button>
          </div>
        ) : isUserSettingsLoading ? (
          <div className="text-gray-400 mt-6">Loading...</div>
        ) : (
          <Dashboard />
        )}
      </div>
    </div>
  );
}
