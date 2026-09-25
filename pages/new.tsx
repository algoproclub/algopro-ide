import { useRouter } from 'next/router';
import React, { useEffect } from 'react';
import { LANGUAGES, useNullableUserContext } from '../src/context/UserContext';
import { useState } from 'react';
import { Language } from '../src/context/EditorContext';
import Link from 'next/link';
import { getDatabase, ref, update } from 'firebase/database';
import { SharingPermissions } from '../src/components/SharingPermissions';
import va from '@vercel/analytics';
import { RadioGroupContents } from '../src/components/settings/RadioGroupContents';
import WithRegistration from '../src/components/WithRegistration';
import PageTitle from '../src/components/PageTitle';
import { Button } from '../src/components/Button';

export const DEFAULT_COMPILER_OPTIONS = {
  cpp: '-std=c++20 -O2 -Wall -Wextra -Wshadow -Wfloat-equal -Wduplicated-cond -Wlogical-op -Wno-sign-compare -Wno-vla-cxx-extension',
  java: '',
  py: '',
};

function PageContent() {
  const { userData, firebaseUser } = useNullableUserContext();
  const router = useRouter();
  const [lang, setLang] = useState<Language>('cpp');
  const [fileName, setFileName] = useState('');
  const [defaultPerimssion, setDefaultPermission] = useState<
    'READ_WRITE' | 'READ' | 'PRIVATE' | null
  >(null);
  const [compilerOptions, setCompilerOptions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPageLoading = !router.isReady || !userData || !firebaseUser;

  useEffect(() => {
    setCompilerOptions(DEFAULT_COMPILER_OPTIONS[lang]);
  }, [lang]);

  useEffect(() => {
    if (!isPageLoading) {
      setLang(userData.defaultLanguage);
      setDefaultPermission(userData.defaultPermission);
    }
  }, [isPageLoading]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPageLoading) {
      alert('Page is still loading, please try again later');
      return;
    }
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
            onChange={setLang}
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
                value={compilerOptions}
                onChange={e => setCompilerOptions(e.target.value)}
                className="theme-input w-full rounded-md border px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 border-t border-line pt-5">
            <Button
              type="submit"
              disabled={isPageLoading || isSubmitting}
              variant="primary"
            >
              {isSubmitting ? 'Creating\u2026' : 'Create File'}
            </Button>
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

export default function NewFilePage() {
  return (
    <>
      <PageTitle>Create new file</PageTitle>
      <WithRegistration>
        <PageContent />
      </WithRegistration>
    </>
  );
}
