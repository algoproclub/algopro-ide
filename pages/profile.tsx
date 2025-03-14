import React, { useEffect, useState, useRef } from 'react';
import { useNullableUserContext } from '../src/context/UserContext';
import UserSettings from '../src/components/settings/UserSettings';
import ProfileStatus from '../src/components/settings/ProfileStatus';
import defaultCode from '../src/scripts/defaultCode';
import { updateUserSettings } from '../src/scripts/updateSettings';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { EditorMode, Language } from '../src/context/UserContext';

export default function ProfilePage(): JSX.Element {
  const [name, setName] = useState<string>('');
  const [cfUsername, setCfUsername] = useState<string>('');
  const [atcoderUsername, setAtcoderUsername] = useState<string>('');
  const [discordID, setDiscordID] = useState<string>('');
  const [defaultLanguage, setDefaultLanguage] = useState<Language>('cpp');
  const [editorMode, setEditorMode] = useState<EditorMode>('Normal');
  const [tabSize, setTabSize] = useState<number>(-1);
  const [lightMode, setLightMode] = useState<boolean>(false);
  const [manualSubmission, setManualSubmission] = useState<boolean>(false);
  const [templateCode, setTemplateCode] = useState<
    Partial<Record<Language, string>>
  >({});
  const [templateLanguage, setTemplateLanguage] = useState<Language>('cpp');
  const dirtyRef = useRef<boolean>(false);

  const [settings, setSettings] = useState<{}>({});

  const {
    firebaseUser,
    userData,
    updateUsername,
    templateCode: savedTemplateCode,
  } = useNullableUserContext();

  useEffect(() => {
    console.log(name);
    setSettings({
      Name: {
        value: name,
        filled: name !== '',
        suggestion: 'Kérlek add meg a neved',
      },
      'Codeforces Username': {
        value: cfUsername,
        filled: cfUsername !== '',
        suggestion: 'Add meg a Codeforces felhasználóneved',
      },
      'AtCoder Username': {
        value: atcoderUsername,
        filled: atcoderUsername !== '',
        suggestion: 'Add meg az AtCoder felhasználóneved',
      },
      'Discord ID': {
        value: discordID,
        filled: discordID !== '',
        suggestion: 'Add meg a Discord ID-d',
      },
      'Template Code': {
        value: templateCode[templateLanguage],
        filled:
          templateCode[templateLanguage] !== defaultCode[templateLanguage],
        suggestion: 'Írj saját template kódot',
      },
    });
  }, [
    name,
    cfUsername,
    atcoderUsername,
    discordID,
    templateCode,
    templateLanguage,
  ]);

  useEffect(() => {
    if (!firebaseUser) return;
    setName(firebaseUser.displayName ?? '');
  }, [firebaseUser]);

  useEffect(() => {
    if (!userData) return;
    setCfUsername(userData.usernames.codeforces ?? '');
    setAtcoderUsername(userData.usernames.atcoder ?? '');
    setDiscordID(userData.discordID ?? '');
    setDefaultLanguage(userData.defaultLanguage ?? '');
    setEditorMode(userData.editorMode);
    setTabSize(userData.tabSize);
    setLightMode(userData.lightMode);
    setManualSubmission(userData.manualSubmission);
    setTemplateCode(userData.templateCode ?? {});
    dirtyRef.current = false;
  }, [userData]);

  const closeWithoutSaving = () => {
    if (dirtyRef.current) {
      if (
        confirm('Are you sure you want to exit without saving your changes?')
      ) {
        console.log('closing without saving');
      }
    } else {
      console.log('closing without saving');
    }
  };

  const saveAndClose = async () => {
    if (!name) {
      alert('Username cannot be empty. Fix before saving.');
      return;
    }

    if (!firebaseUser) {
      alert('You must be signed in to save settings');
      return;
    }
    updateUserSettings({
      userID: firebaseUser.uid,
      cfUsername,
      atcoderUsername,
      defaultLanguage,
      discordID,
      editorMode,
      tabSize,
      lightMode,
      manualSubmission,
      templateCode,
    });
    if (name !== firebaseUser.displayName) {
      await updateUsername(name);
    }
  };

  return (
    <div className="p-6 sm:p-8 md:p-10 lg:p-12 min-h-screen flex flex-col max-w-7xl mx-auto">
      <h1 className="text-gray-100 text-3xl font-extrabold mb-6">Profile</h1>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* User Settings Section */}
        <div className="flex-1 bg-[#1e1e1e] p-6 rounded-lg border border-gray-700 shadow-md">
          <UserSettings
            name={name}
            onNameChange={name => setName(name)}
            cfUsername={cfUsername}
            onCfUsernameChange={cfUsername => {
              setCfUsername(cfUsername);
              dirtyRef.current = true;
            }}
            atcoderUsername={atcoderUsername}
            onAtcoderUsernameChange={atcoderUsername => {
              setAtcoderUsername(atcoderUsername);
              dirtyRef.current = true;
            }}
            discordID={discordID}
            onDiscordIDChange={discordID => {
              setDiscordID(discordID);
              dirtyRef.current = true;
            }}
            defaultLanguage={defaultLanguage}
            onDefaultLanguageChange={language => {
              setDefaultLanguage(language);
              dirtyRef.current = true;
            }}
            editorMode={editorMode}
            onEditorModeChange={mode => {
              setEditorMode(mode);
              dirtyRef.current = true;
            }}
            tabSize={tabSize}
            onTabSizeChange={size => {
              setTabSize(size);
              dirtyRef.current = true;
            }}
            lightMode={lightMode}
            onLightModeChange={lightMode => {
              setLightMode(lightMode);
              dirtyRef.current = true;
            }}
            manualSubmission={manualSubmission}
            onManualSubmissionChange={manualSubmission => {
              setManualSubmission(manualSubmission);
              dirtyRef.current = true;
            }}
            templateCode={templateCode}
            onTemplateCodeChange={code => {
              setTemplateCode(code);
              dirtyRef.current = true;
            }}
            language={templateLanguage}
            onLanguageChange={setTemplateLanguage}
          />

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              className="px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-700 focus:ring-2 focus:ring-indigo-500"
              onClick={closeWithoutSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-md focus:ring-2 focus:ring-indigo-500"
              onClick={saveAndClose}
            >
              Save
            </button>
          </div>
        </div>

        {/* Profile Status Section */}
        <div className="flex-shrink-0 w-full lg:w-2/5">
          <ProfileStatus settings={settings} />
        </div>
      </div>

      <div className="absolute top-4 right-4">
        <button
          type="button"
          className="rounded-md text-gray-200 hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          onClick={closeWithoutSaving}
        >
          <span className="sr-only">Close</span>
          <XMarkIcon className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
