import { useRouter } from 'next/router';
import React from 'react';
import {
  LANGUAGES,
  UserData,
  useNullableUserContext,
} from '../src/context/UserContext';
import { useState } from 'react';
import { Language } from '../src/context/EditorContext';
import Link from 'next/link';
import { getDatabase, ref, update } from 'firebase/database';
import { User } from 'firebase/auth';
import { SharingPermissions } from '../src/components/SharingPermissions';
import va from '@vercel/analytics';
import { RadioGroupContents } from '../src/components/settings/RadioGroupContents';
import WithRegistration from '../src/components/WithRegistration';
import PageTitle from '../src/components/PageTitle';
import { MessagePage } from '../src/components/MessagePage';

export const DEFAULT_COMPILER_OPTIONS = {
  cpp: '-std=c++20 -O2 -Wall -Wextra -Wshadow -Wfloat-equal -Wduplicated-cond -Wlogical-op -Wno-sign-compare -Wno-vla-cxx-extension',
  java: '',
  py: '',
};

function NewFileForm({
  userData,
  firebaseUser,
}: {
  userData: UserData;
  firebaseUser: User;
}) {
  const router = useRouter();
  const [lang, setLang] = useState<Language>(userData.defaultLanguage);
  const [fileName, setFileName] = useState('');
  const [defaultPerimssion, setDefaultPermission] = useState<
    'READ_WRITE' | 'READ' | 'PRIVATE'
  >(userData.defaultPermission);
  const [compilerOptions, setCompilerOptions] = useState(
    DEFAULT_COMPILER_OPTIONS[userData.defaultLanguage]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fileName) {
      alert('Please enter a file name.');
      return;
    }
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    (async () => {
      va.track('Create File', { type: 'new-file' });
      update(ref(getDatabase(), `users/${firebaseUser.uid}/data`), {
        defaultLanguage: lang,
        defaultPermission: 'READ_WRITE',
      });
      const resp = await fetch(`/api/createNewFile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceName: fileName,
          userID: firebaseUser.uid,
          userName: firebaseUser.displayName,
          defaultPermission: defaultPerimssion,
          language: lang,
          compilerOptions: {
            ...DEFAULT_COMPILER_OPTIONS,
            [lang]: compilerOptions,
          },
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        router.push(`/${data.fileID.substring(1)}`);
      } else {
        alert('Error: ' + data.message);
      }
    })();
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-6 sm:px-6">
      <form
        className="theme-surface theme-border overflow-hidden rounded-lg border shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="theme-surface-raised theme-text theme-border border-b px-5 py-4 sm:px-6">
          <h1 className="text-lg font-semibold">Create New File</h1>
        </div>
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <label
              htmlFor="filename"
              className="block text-sm font-medium leading-6 theme-text"
            >
              File Name
            </label>
            <div className="mt-1.5">
              <input
                type="text"
                name="filename"
                id="filename"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                className="theme-input w-full rounded-md border px-3 py-2 text-sm"
                autoFocus
              />
            </div>
          </div>
          <div>
            <SharingPermissions
              value={defaultPerimssion}
              className="text-sm"
              onChange={setDefaultPermission}
              isOwner={true}
            />
          </div>
          <RadioGroupContents
            title="Language"
            value={lang}
            onChange={language => {
              setLang(language);
              setCompilerOptions(DEFAULT_COMPILER_OPTIONS[language]);
            }}
            options={LANGUAGES}
          />
          <div>
            <label
              htmlFor="compilerOptions"
              className="block text-sm font-medium leading-6 theme-text"
            >
              Compiler Options
            </label>
            <div className="mt-1.5">
              <input
                type="text"
                name="compilerOptions"
                id="compilerOptions"
                readOnly
                value={compilerOptions}
                onChange={e => setCompilerOptions(e.target.value)}
                className="theme-input w-full rounded-md border px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 border-t border-line pt-5">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex justify-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium theme-button-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--app-bg)] focus:ring-[color:var(--accent)]"
            >
              {isSubmitting ? 'Creating\u2026' : 'Create File'}
            </button>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border shadow-sm text-[0.92rem] font-medium rounded-md theme-button-secondary focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}

function PageContent() {
  const { userData, firebaseUser } = useNullableUserContext();
  const router = useRouter();

  if (!router.isReady || !userData || !firebaseUser)
    return <MessagePage message="Loading…" showHomeButton={false} />;

  return <NewFileForm userData={userData} firebaseUser={firebaseUser} />;
}

export default function NewFilePage() {
  return (
    <>
      <PageTitle>Create new file</PageTitle>
      <WithRegistration waitForUserData>
        <PageContent />
      </WithRegistration>
    </>
  );
}
