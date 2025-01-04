import { useUpdateAtom } from 'jotai/utils';
import { signInWithGoogleAtom } from '../../src/atoms/firebaseUserAtoms';
import { useConnectionContext } from '../../src/context/ConnectionContext';
import React, { useEffect } from 'react';
import { useNullableUserContext } from '../../src/context/UserContext';
import { useRouter } from 'next/router';
import { ConfirmOverrideModal } from '../../src/components/ConfirmOverrideModal';

export default function Register() {
  const { firebaseUser, logged } = useNullableUserContext();
  const signInWithGoogle = useUpdateAtom(signInWithGoogleAtom);
  const connectionContext = useConnectionContext();
  const router = useRouter();

  const login = () => {
    if (router.isReady) {
      try {
        signInWithGoogle(connectionContext);
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {}, [router.isReady, logged]);

  useEffect(() => {
    const makeRequest = async (token: string, userID: string) => {
      const resp = await fetch(`/api/handleRegistration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          userID,
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
      makeRequest(router.query.token, firebaseUser.uid).then(resp => {
        if (!resp.ok) {
          alert('Error: ' + resp.message);
        }
        router.push(`/`);
      });
    }
  }, [firebaseUser?.isAnonymous, router.isReady]);

  return (
    <div className="w-full mx-auto flex justify-center pt-2 sm:pt-6 px-2">
      <div className="w-full sm:w-80 bg-gray-800 border-gray-700 border">
        <div className="font-semibold block text-center py-4 px-6 border-b border-gray-700">
          Registration
        </div>
        <div className="py-4 px-6">
          <button
            className="block items-center w-full px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1E1E1E] focus:ring-indigo-500"
            onClick={login}
          >
            Sign in now
          </button>
        </div>
      </div>
      <ConfirmOverrideModal />
    </div>
  );
}
