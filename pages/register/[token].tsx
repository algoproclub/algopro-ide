import { useUpdateAtom } from 'jotai/utils';
import { signInWithGoogleAtom } from '../../src/atoms/firebaseUserAtoms';
import { useConnectionContext } from '../../src/context/ConnectionContext';
import { useEffect } from 'react';
import { useNullableUserContext } from '../../src/context/UserContext';
import { useRouter } from 'next/router';
import { ConfirmOverrideModal } from '../../src/components/ConfirmOverrideModal';

export default function Register() {
  const { firebaseUser, logged } = useNullableUserContext();
  const signInWithGoogle = useUpdateAtom(signInWithGoogleAtom);
  const connectionContext = useConnectionContext();
  const router = useRouter();

  useEffect(() => {
    if (router.isReady && logged === false) {
      try {
        signInWithGoogle(connectionContext);
      } catch (e) {
        console.error(e);
      }
    }
  }, [router.isReady, logged]);

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
      !firebaseUser!.isAnonymous &&
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
    <>
      <ConfirmOverrideModal />
    </>
  );
}
