import { useNullableUserContext } from '../../context/UserContext';
import { useUpdateAtom } from 'jotai/utils';
import {
  signInWithGoogleAtom,
  signInWithMicrosoftAtom,
  signInWithGithubAtom,
  signOutAtom,
} from '../../atoms/firebaseUserAtoms';
import {
  ConnectionContextType,
  useConnectionContext,
} from '../../context/ConnectionContext';
import { useRouter } from 'next/router';
import React, { useEffect } from 'react';
import { ConfirmOverrideModal } from '../ConfirmOverrideModal';
import {
  SignInButton,
  GoogleIcon,
  MicrosoftIcon,
  GithubIcon,
} from '../SignInButton';

export default function Register({ handlerURL }: { handlerURL: string }) {
  const { firebaseUser, logged } = useNullableUserContext();
  const signInWithGoogle = useUpdateAtom(signInWithGoogleAtom);
  const signInWithMicrosoft = useUpdateAtom(signInWithMicrosoftAtom);
  const signInWithGithub = useUpdateAtom(signInWithGithubAtom);
  const signOut = useUpdateAtom(signOutAtom);
  const connectionContext = useConnectionContext();
  const router = useRouter();

  const login = (handler: (ctx: ConnectionContextType) => void) => {
    if (router.isReady) {
      try {
        handler(connectionContext);
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {}, [router.isReady, logged]);

  useEffect(() => {
    const makeRequest = async (
      token: string,
      userID: string,
      name: string | null
    ) => {
      const resp = await fetch(handlerURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          userID,
          name,
        }),
      });
      return { message: await resp.text(), ok: resp.ok };
    };
    if (
      firebaseUser &&
      !firebaseUser.isAnonymous &&
      router.isReady &&
      typeof router.query.token === 'string'
    ) {
      makeRequest(
        router.query.token,
        firebaseUser.uid,
        firebaseUser.displayName
      ).then(resp => {
        if (!resp.ok) {
          alert('Error: ' + resp.message);
        } else {
          signOut(connectionContext);
        }
        router.push(`/`);
      });
    }
  }, [firebaseUser?.isAnonymous, router.isReady]);

  return (
    <div className="w-full mx-auto flex justify-center pt-2 sm:pt-6 px-2">
      {logged === false && (
        <>
          <div className="w-full sm:w-80 bg-gray-800 border-gray-700 border">
            <div className="font-semibold block text-center py-4 px-6 border-b border-gray-700">
              Registration
            </div>
            <div className="py-4 px-6 flex flex-wrap gap-2">
              <SignInButton
                service="Google"
                Icon={GoogleIcon}
                onClick={() => login(signInWithGoogle)}
              />
              <SignInButton
                service="Microsoft"
                Icon={MicrosoftIcon}
                onClick={() => login(signInWithMicrosoft)}
              />
              <SignInButton
                service="GitHub"
                Icon={GithubIcon}
                onClick={() => login(signInWithGithub)}
              />
            </div>
          </div>
          <ConfirmOverrideModal />
        </>
      )}
    </div>
  );
}
