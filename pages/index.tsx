import React, { useEffect, useState } from 'react';
import { ConfirmOverrideModal } from '../src/components/ConfirmOverrideModal';
import { useSetAtom } from 'jotai';
import {
  signInWithGoogleAtom,
  signInWithMicrosoftAtom,
  signInWithGithubAtom,
} from '../src/atoms/firebaseUserAtoms';
import {
  SignInButton,
  GoogleIcon,
  MicrosoftIcon,
  GithubIcon,
} from '../src/components/SignInButton';
import Dashboard from '../src/components/Dashboard/Dashboard';
import { useNullableUserContext } from '../src/context/UserContext';
import ProfileSettings from '../src/components/settings/ProfileSettings';
import { SettingsMenu } from '../src/components/NavBar/SettingsMenu';
import NoRegistrationMessage from '../src/NoRegistrationMessage';
import { useConnectionContext } from '../src/context/ConnectionContext';

export default function DashboardPage(): JSX.Element {
  const { userData, logged, registered } = useNullableUserContext();
  const connectionContext = useConnectionContext();
  const signInWithGoogle = useSetAtom(signInWithGoogleAtom);
  const signInWithMicrosoft = useSetAtom(signInWithMicrosoftAtom);
  const signInWithGithub = useSetAtom(signInWithGithubAtom);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.title = 'AlgoPro IDE';
  }, []);

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-12 min-h-full flex flex-col max-w-6xl mx-auto">
      <ConfirmOverrideModal />
      <div className="flex-1 relative">
        <ProfileSettings isOpen={isOpen} onClose={() => setIsOpen(false)} />
        <div className="absolute top-4 right-4">
          {logged && <SettingsMenu setIsProfileSettingsOpen={setIsOpen} />}
        </div>
        <h1 className="text-gray-100 text-2xl md:text-4xl font-black">
          AlgoPro IDE
        </h1>
        <div className="text-gray-400 mt-6 mb-2">
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

        {logged === false ? (
          <>
            <div className="text-gray-400">Not signed in.</div>
            <div className="mt-2 space-x-2">
              <SignInButton
                service="Google"
                Icon={GoogleIcon}
                onClick={() => signInWithGoogle(connectionContext)}
              />
              <SignInButton
                service="Microsoft"
                Icon={MicrosoftIcon}
                onClick={() => signInWithMicrosoft(connectionContext)}
              />
              <SignInButton
                service="GitHub"
                Icon={GithubIcon}
                onClick={() => signInWithGithub(connectionContext)}
              />
            </div>
          </>
        ) : !userData ? (
          <div className="text-gray-400">Loading...</div>
        ) : !registered ? (
          <NoRegistrationMessage />
        ) : (
          <Dashboard />
        )}
      </div>
    </div>
  );
}
