import { useRouter } from 'next/router';
import React, { useEffect, useRef } from 'react';
import { MessagePage } from '../src/components/MessagePage';
import { useNullableUserContext } from '../src/context/UserContext';
import { DEFAULT_COMPILER_OPTIONS } from './new';
import va from '@vercel/analytics';

export default function NewFilePage() {
  const router = useRouter();
  const { userData, firebaseUser, logged } = useNullableUserContext();

  const loginUI = (
    <MessagePage
      message="Please login to create files."
      showHomeButton={true}
    />
  );
  const loadingUI = (
    <MessagePage showHomeButton={false} message="Creating new file..." />
  );

  const alreadyCreatedFile = useRef<boolean>(false);

  useEffect(() => {
    if (userData && firebaseUser && !alreadyCreatedFile.current) {
      alreadyCreatedFile.current = true;
      (async () => {
        va.track('Create File', { type: 'new-file-shortcut' });
        const resp = await fetch(`/api/createNewFile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspaceName: 'Unnamed Workspace',
            userID: firebaseUser.uid,
            userName: firebaseUser.displayName, // TODO TEST
            defaultPermission: userData.defaultPermission,
            language: userData.defaultLanguage,
            compilerOptions: DEFAULT_COMPILER_OPTIONS,
          }),
        });
        const data = await resp.json();
        if (resp.ok) {
          router.push(`/${data.fileID.substring(1)}`);
        } else {
          alert('Error: ' + data.message);
        }
      })();
    }
  }, [userData, firebaseUser]);

  if (logged === false) return loginUI;
  return loadingUI;
}
