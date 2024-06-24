import React, { useEffect } from 'react';
import { ConfirmOverrideModal } from '../src/components/ConfirmOverrideModal';
import { useSetAtom } from 'jotai';
import { signInWithGoogleAtom } from '../src/atoms/firebaseUserAtoms';
import Dashboard from '../src/components/Dashboard/Dashboard';
import { useConnectionContext } from '../src/context/ConnectionContext';
import { useNullableUserContext } from '../src/context/UserContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function DashboardPage(): JSX.Element {
  const signInWithGoogle = useSetAtom(signInWithGoogleAtom);
  const connectionContext = useConnectionContext();
  const { userData, logged } = useNullableUserContext();

  useEffect(() => {
    document.title = 'AlgoPro IDE';
  }, []);

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-12 min-h-full flex flex-col max-w-6xl mx-auto">
      <ConfirmOverrideModal />
      <div className="flex-1">
        <h1 className="text-gray-100 text-2xl md:text-4xl font-black">
          AlgoPro IDE
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

        <div className="h-1"></div>

        {logged === false ? (
          <div className="text-gray-400">
            Not signed in.{' '}
            <button
              className="mt-3 block items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1E1E1E] focus:ring-indigo-500"
              onClick={() => signInWithGoogle(connectionContext)}
            >
              Sign in now
            </button>
          </div>
        ) : !userData ? (
          <div className="text-gray-400">Loading...</div>
        ) : (
          <Dashboard />
        )}
      </div>
    </div>
  );
}
