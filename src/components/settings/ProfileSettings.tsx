import React, { useEffect, useState, useRef, Fragment } from 'react';
import { useNullableUserContext } from '../../context/UserContext';
import { updateUserSettings } from '../../scripts/updateSettings';
import { Language, EditorMode } from '../../context/UserContext';
import UserSettings from './UserSettings';
import ProfileStatus from './ProfileStatus';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';
import defaultCode from '../../scripts/defaultCode';

const ProfileSettings = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [name, setName] = useState<string>('');
  const [cfUsername, setCfUsername] = useState<string>('');
  const [atcoderUsername, setAtcoderUsername] = useState<string>('');
  const [discordID, setDiscordID] = useState<string>('');
  const [defaultLanguage, setDefaultLanguage] = useState<Language>('cpp');
  const [editorMode, setEditorMode] = useState<EditorMode>('Normal');
  const [tabSize, setTabSize] = useState<number>(-1);
  const [lightMode, setLightMode] = useState<boolean>(false);
  const [rainbowIndent, setRainbowIndent] = useState<boolean>(false);
  const [manualSubmission, setManualSubmission] = useState<boolean>(false);
  const [templateCode, setTemplateCode] = useState<
    Partial<Record<Language, string>>
  >({});
  const [templateLanguage, setTemplateLanguage] = useState<Language>('cpp');
  const dirtyRef = useRef<boolean>(false);
  const [settings, setSettings] = useState({});

  const {
    firebaseUser,
    userData,
    updateUsername,
    templateCode: savedTemplateCode,
  } = useNullableUserContext();

  useEffect(() => {
    if (isOpen) {
      setName(firebaseUser?.displayName ?? '');
      setCfUsername(userData?.usernames.codeforces ?? '');
      setAtcoderUsername(userData?.usernames.atcoder ?? '');
      setDiscordID(userData?.discordID ?? '');
      setDefaultLanguage(userData?.defaultLanguage ?? 'cpp');
      setEditorMode(userData?.editorMode ?? 'Normal');
      setTabSize(userData?.tabSize ?? -1);
      setLightMode(userData?.lightMode ?? false);
      setRainbowIndent(userData?.rainbowIndent ?? false);
      setManualSubmission(userData?.manualSubmission ?? false);
      setTemplateCode(savedTemplateCode ?? {});
      setTemplateLanguage(userData?.defaultLanguage ?? 'cpp');
      dirtyRef.current = false;
    }
  }, [isOpen, firebaseUser, userData, savedTemplateCode]);

  useEffect(() => {
    setSettings({
      Name: {
        value: name,
        filled: name !== '',
        suggestion: 'Please enter your name',
      },
      'Codeforces Username': {
        value: cfUsername,
        filled: cfUsername !== '',
        suggestion: 'Please enter your Codeforces username',
      },
      'AtCoder Username': {
        value: atcoderUsername,
        filled: atcoderUsername !== '',
        suggestion: 'Please enter your AtCoder username',
      },
      'Discord ID': {
        value: discordID,
        filled: discordID !== '',
        suggestion: 'Please enter your Discord ID',
      },
      'Template Code': {
        value: templateCode[templateLanguage],
        filled:
          templateCode[templateLanguage] !== defaultCode[templateLanguage],
        suggestion: 'Please enter your template code',
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

  const closeWithoutSaving = () => {
    if (dirtyRef.current) {
      if (
        confirm('Are you sure you want to exit without saving your changes?')
      ) {
        onClose();
      }
    } else {
      onClose();
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
      rainbowIndent,
      manualSubmission,
      templateCode,
    });

    if (name !== firebaseUser.displayName) {
      await updateUsername(name);
    }

    onClose();
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        static
        className="fixed z-10 inset-0 overflow-y-auto"
        open={isOpen}
        onClose={closeWithoutSaving}
      >
        <div className="flex items-end justify-center min-h-full pt-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div
              className="inline-block bg-[var(--panel-bg)] text-[color:var(--text-primary)] md:rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 w-full"
              style={{ maxWidth: '1100px' }}
            >
              <div className="px-4 sm:px-6 pt-4 pb-2">
                <Dialog.Title
                  as="h3"
                  className="text-lg leading-6 font-medium text-center"
                >
                  Profile Settings
                </Dialog.Title>
              </div>
              <div className="p-4 sm:p-6 space-y-3">
                <div className="flex flex-col lg:flex-row gap-10">
                  {/* User Settings Section */}
                  <div className="flex-1 bg-[var(--panel-bg-alt)] p-6 rounded-lg border border-[var(--border-color)] shadow-md overflow-auto">
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
                      rainbowIndent={rainbowIndent}
                      onRainbowIndentChange={rainbowIndent => {
                        setRainbowIndent(rainbowIndent);
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
                        className="px-4 py-2 border border-[var(--border-color)] rounded-md text-[color:var(--text-primary)] hover:bg-[var(--hover-bg)] focus:ring-2 focus:ring-indigo-500"
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
              </div>
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="rounded-md text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onClick={closeWithoutSaving}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default ProfileSettings;
