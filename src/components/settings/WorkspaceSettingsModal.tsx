import React, {
  Fragment,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import WorkspaceSettingsUI from './WorkspaceSettingsUI';
import {
  EditorMode,
  Language,
  useUserContext,
} from '../../context/UserContext';
import { FileSettings, useEditorContext } from '../../context/EditorContext';
import useUserPermission from '../../hooks/useUserPermission';
import { updateUserSettings } from '../../scripts/updateSettings';
import { DEFAULT_FONT_SIZE_EDITOR } from '../../constants/editorConstants';

export interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onResetLayout: () => void;
}

export const WorkspaceSettingsModal = ({
  isOpen,
  onClose,
  onResetLayout,
}: SettingsDialogProps): JSX.Element => {
  const {
    userData,
    firebaseUser,
    updateUsername,
    templateCode: savedTemplateCode,
  } = useUserContext();
  const {
    fileData,
    updateFileData: updateRealFileData,
    doNotInitializeTheseFileIdsRef,
  } = useEditorContext();
  const realFileSettings = fileData.settings;
  const userPermission = useUserPermission();

  const [fileSettings, setFileSettings] = useReducer(
    (prev: FileSettings, next: Partial<FileSettings>) => {
      return {
        ...prev,
        ...next,
      };
    },
    realFileSettings
  );

  const [name, setName] = useState<string>('');
  const [cfUsername, setCfUsername] = useState<string>('');
  const [atcoderUsername, setAtcoderUsername] = useState<string>('');
  const [discordID, setDiscordID] = useState<string>('');
  const [defaultLanguage, setDefaultLanguage] = useState<Language>('cpp');
  const [editorMode, setEditorMode] = useState<EditorMode>('Normal');
  const [tabSize, setTabSize] = useState<number>(-1);
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE_EDITOR);
  const [lightMode, setLightMode] = useState<boolean>(false);
  const [rainbowIndent, setRainbowIndent] = useState<boolean>(false);
  const [manualSubmission, setManualSubmission] = useState<boolean>(false);
  const [templateCode, setTemplateCode] = useState<
    Partial<Record<Language, string>>
  >({});
  const dirtyRef = useRef<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setFileSettings(realFileSettings);
      setName(firebaseUser.displayName ?? ''); // todo this shouldn't really be an empty string ever?
      setCfUsername(userData.usernames.codeforces ?? '');
      setAtcoderUsername(userData.usernames.atcoder ?? '');
      setDiscordID(userData.discordID ?? '');
      setDefaultLanguage(userData.defaultLanguage ?? '');
      setEditorMode(userData.editorMode);
      setTabSize(userData.tabSize);
      setFontSize(userData.fontSize);
      setLightMode(userData.lightMode);
      setRainbowIndent(userData.rainbowIndent);
      setManualSubmission(userData.manualSubmission);
      setTemplateCode(savedTemplateCode);
      dirtyRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
    let settingsToSet: Partial<FileSettings> = fileSettings;
    {
      // update has no effect if you try to overwrite creation time
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { creationTime, ...toKeep } = settingsToSet;
      settingsToSet = toKeep;
    }
    if (userPermission !== 'OWNER') {
      // update has no effect if you try to overwrite default permission
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { defaultPermission, ...toKeep } = settingsToSet;
      settingsToSet = toKeep;
    }

    if (realFileSettings.language !== settingsToSet.language) {
      // The language changed.
      // This means we might have to initialize the code for the new language.
      // We need this ref here to prevent all connected clients from initializing
      // the code (we only want the client who initiated the language change
      // to initialize the code)
      // For more info, see EditorContex.tsx
      doNotInitializeTheseFileIdsRef.current[
        // the key is the yjs document ID
        fileData.id + '.' + settingsToSet.language
      ] = false;
    }
    await updateRealFileData({
      settings: { ...realFileSettings, ...settingsToSet },
    });
    updateUserSettings({
      userID: firebaseUser.uid,
      cfUsername,
      atcoderUsername,
      defaultLanguage,
      discordID,
      editorMode,
      tabSize,
      fontSize,
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

  const onChange = (data: Partial<FileSettings>): void => {
    dirtyRef.current = true;
    setFileSettings(data);
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        static
        className="fixed z-10 inset-0 overflow-y-auto"
        open={isOpen}
        onClose={() => closeWithoutSaving()}
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
            <div className="ui-panel relative z-10 inline-block w-full overflow-hidden border text-left shadow-xl transition-all md:rounded-lg sm:my-8 sm:max-w-2xl">
              <div className="px-4 sm:px-6 pt-4 pb-2">
                <Dialog.Title
                  as="h3"
                  className="text-lg leading-6 font-medium text-center"
                >
                  Workspace Settings
                </Dialog.Title>
              </div>
              <div className="p-4 sm:p-6 space-y-3">
                <WorkspaceSettingsUI
                  workspaceSettings={fileSettings}
                  onWorkspaceSettingsChange={onChange}
                  userPermission={userPermission || 'READ'}
                />
                <div className="border-t border-line pt-4">
                  <button
                    type="button"
                    className="ui-button-secondary px-4 py-2 text-[0.92rem]"
                    onClick={onResetLayout}
                  >
                    Reset workspace layout
                  </button>
                </div>
                <div className="flex items-center justify-end space-x-2.5">
                  <button
                    type="button"
                    className="ui-button-secondary px-4 py-2 text-[0.92rem]"
                    onClick={closeWithoutSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ui-button-primary px-4 py-2"
                    onClick={saveAndClose}
                  >
                    Save
                  </button>
                </div>
              </div>
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="ui-icon-button"
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
