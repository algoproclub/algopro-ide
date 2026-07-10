import React, { useEffect } from 'react';
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
import NoRegistrationMessage from '../src/NoRegistrationMessage';
import { useConnectionContext } from '../src/context/ConnectionContext';

export default function DashboardPage(): JSX.Element {
  const { userData, logged, registered } = useNullableUserContext();
  const connectionContext = useConnectionContext();
  const signInWithGoogle = useSetAtom(signInWithGoogleAtom);
  const signInWithMicrosoft = useSetAtom(signInWithMicrosoftAtom);
  const signInWithGithub = useSetAtom(signInWithGithubAtom);

  useEffect(() => {
    document.title = 'AlgoPro IDE';
  }, []);

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-12 min-h-full flex flex-col max-w-6xl mx-auto theme-page">
      <ConfirmOverrideModal />
      <div className="flex-1 relative">
        <h1 className="theme-text text-2xl md:text-4xl font-black">
          AlgoPro IDE
        </h1>
        <div className="theme-text-muted mt-6 mb-2">
          Based on the{' '}
          <a
            className="underline text-[color:var(--text-secondary)] hover:text-[color:var(--accent-hover)]"
            href="https://github.com/cpinitiative/ide"
          >
            Real-Time Collaborative Online IDE
          </a>{' '}
          by{' '}
          <a
            className="underline text-[color:var(--text-secondary)] hover:text-[color:var(--accent-hover)]"
            href="https://joincpi.org/"
          >
            Competitive Programming Initiative
          </a>
        </div>

        {logged === false ? (
          <>
            <div className="theme-text-muted">Not signed in.</div>
            <div className="mt-2 flex flex-wrap gap-2">
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
          <div className="theme-text-muted">Loading...</div>
        ) : !registered ? (
          <NoRegistrationMessage />
        ) : (
          <Dashboard />
        )}
      </div>
    </div>
  );
}
