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

export const DEFAULT_COMPILER_OPTIONS = {
  cpp: '-std=c++17 -O2 -Wall -Wextra -Wshadow -Wconversion -Wfloat-equal -Wduplicated-cond -Wlogical-op',
  java: '',
  py: '',
};

export default function NewFilePage() {
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
    <div className="min-h-full flex flex-col max-w-6xl mx-auto lg:mt-6">
      <form className="border border-gray-700" onSubmit={handleSubmit}>
        <div className="text-white font-semibold py-2 px-4 lg:px-8 bg-gray-800">
          <h1 className="text-lg">Create New File</h1>
        </div>
        <div className="border-t border-gray-700 space-y-4 sm:space-y-6 p-4 lg:p-8">
          <div>
            <label
              htmlFor="filename"
              className="block text-sm font-medium leading-6 text-gray-100"
            >
              File Name
            </label>
            <div className="mt-0">
              <input
                type="text"
                name="filename"
                id="filename"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                className="text-input"
                autoFocus
              />
            </div>
          </div>
          <div className="mb-4">
            <SharingPermissions
              value={defaultPerimssion}
              className="text-sm"
              onChange={setDefaultPermission}
              isOwner={true}
              lightMode={false}
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
              className="block text-sm font-medium leading-6 text-gray-100"
            >
              Compiler Options
            </label>
            <div className="mt-2">
              <input
                type="text"
                name="compilerOptions"
                id="compilerOptions"
                value={compilerOptions}
                onChange={e => setCompilerOptions(e.target.value)}
                className="text-input font-mono !text-[0.85rem]"
              />
            </div>
          </div>
          <div className="mt-6 space-x-2.5">
            <button
              type="submit"
              disabled={isPageLoading || isSubmitting}
              className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {isSubmitting ? 'Creating...' : 'Create File'}
            </button>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-gray-700 shadow-sm text-[0.92rem] font-medium rounded-md text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
