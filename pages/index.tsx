import React from 'react';
import ConfirmOverrideModal from '../src/components/ConfirmOverrideModal';
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

const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'AlgoPro IDE';

export default function DashboardPage(): JSX.Element {
  const { userData, logged, registered } = useNullableUserContext();
  const connectionContext = useConnectionContext();
  const signInWithGoogle = useSetAtom(signInWithGoogleAtom);
  const signInWithMicrosoft = useSetAtom(signInWithMicrosoftAtom);
  const signInWithGithub = useSetAtom(signInWithGithubAtom);

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col px-4 py-5 theme-page sm:px-6 sm:py-6 lg:px-8">
      <ConfirmOverrideModal />
      <div className="flex-1 relative">
        <h1 className="theme-text text-2xl font-bold tracking-tight md:text-3xl">
          {productName}
        </h1>
        <div className="mb-5 mt-1.5 max-w-3xl text-sm leading-6 theme-text-muted">
          Based on the{' '}
          <a
            className="underline decoration-line-strong underline-offset-4 hover:text-content"
            href="https://github.com/cpinitiative/ide"
          >
            Real-Time Collaborative Online IDE
          </a>{' '}
          by{' '}
          <a
            className="underline decoration-line-strong underline-offset-4 hover:text-content"
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
          <div className="theme-text-muted">Loading&hellip;</div>
        ) : !registered ? (
          <NoRegistrationMessage />
        ) : (
          <Dashboard />
        )}
      </div>
    </div>
  );
}
