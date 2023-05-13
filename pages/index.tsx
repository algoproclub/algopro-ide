import React, { useEffect } from 'react';
import { ConfirmOverrideModal } from '../src/components/ConfirmOverrideModal';
import { useAtomValue, useUpdateAtom } from 'jotai/utils';
import {
  signInWithGoogleAtom,
} from '../src/atoms/firebaseUserAtoms';
import Dashboard from '../src/components/Dashboard/Dashboard';
import { useConnectionContext } from '../src/context/ConnectionContext';
import {
  useNullableUserContext,
  useUserContext,
} from '../src/context/UserContext';

export default function DashboardPage(): JSX.Element {
  const signInWithGoogle = useUpdateAtom(signInWithGoogleAtom);
  const connectionContext = useConnectionContext();
  const { firebaseUser, userData } = useNullableUserContext();

  useEffect(() => {
    document.title = 'Planets IDE';
  }, []);

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-12 min-h-full flex flex-col max-w-6xl mx-auto">
      <ConfirmOverrideModal />
      <div className="flex-1">
        <h1 className="text-gray-100 text-2xl md:text-4xl font-black">
          Planets IDE
        </h1>
        <div className="text-gray-400 mt-6">
          Based on the{' '}
          <a
            className="underline text-gray-200"
            href="https://github.com/cpinitiative/ide"
          >
            Real-Time Collaborative Online IDE
          </a>{' '}
          by{' '}
          <a className="underline text-gray-200" href="https://joincpi.org/">
            Competitive Programming Initiative
          </a>
        </div>

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
        ) : !userData ? (
          <div className="text-gray-400 mt-6">Loading...</div>
        ) : (
          <Dashboard />
        )}
      </div>
    </div>
  );
}
