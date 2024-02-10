import { RadioGroup } from '@headlessui/react';
import classNames from 'classnames';
import React from 'react';
import { EditorMode } from '../../context/UserContext';

const EDITOR_MODES = ['Normal', 'Vim' /*'Emacs'*/];

export default function UserSettings({
  name,
  onNameChange,
  cfUsername,
  onCfUsernameChange,
  discordID,
  onDiscordIDChange,
  editorMode,
  onEditorModeChange,
  tabSize,
  onTabSizeChange,
  lightMode,
  onLightModeChange,
  manualSubmission,
  onManualSubmissionChange,
}: {
  name: string;
  onNameChange: (name: string) => void;
  cfUsername: string;
  onCfUsernameChange: (cfUsername: string) => void;
  discordID: string;
  onDiscordIDChange: (discordID: string) => void;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
  tabSize: number;
  onTabSizeChange: (tabSize: number) => void;
  lightMode: boolean;
  onLightModeChange: (lightMode: boolean) => void;
  manualSubmission: boolean;
  onManualSubmissionChange: (manualSubmission: boolean) => void;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={`name`}
          className="block text-gray-700 text-[0.92rem] font-medium"
        >
          Username
        </label>
        <div className="mt-1">
          <input
            type="text"
            name={`name`}
            id={`name`}
            className="mt-0 block w-full px-0 pt-0 pb-1 border-0 border-b-2 border-gray-200 focus:ring-0 focus:border-black text-sm"
            value={name}
            onChange={e => {
              onNameChange(e.target.value);
            }}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor={`cf-username`}
          className="block text-[0.92rem] font-medium text-gray-700"
        >
          Codeforces username
        </label>
        <div className="mt-1">
          <input
            type="text"
            name={`cf-username`}
            id={`cf-username`}
            className="mt-0 block w-full px-0 pt-0 pb-1 border-0 border-b-2 border-gray-200 focus:ring-0 focus:border-black text-sm"
            value={cfUsername}
            onChange={e => {
              onCfUsernameChange(e.target.value);
            }}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor={`discord-username`}
          className="block text-[0.92rem] font-medium text-gray-700"
        >
          Discord user ID
        </label>
        <div className="mt-1">
          <input
            type="text"
            name={`discord-username`}
            id={`discord-username`}
            className="mt-0 block w-full px-0 pt-0 pb-1 border-0 border-b-2 border-gray-200 focus:ring-0 focus:border-black text-sm"
            value={discordID}
            onChange={e => {
              onDiscordIDChange(e.target.value);
            }}
          />
        </div>
      </div>
      <div>
        <RadioGroup value={editorMode} onChange={onEditorModeChange}>
          <RadioGroup.Label className="text-gray-700 text-[0.92rem] font-medium">
            Editor Mode
          </RadioGroup.Label>
          <div className="bg-white rounded-md space-x-4">
            {EDITOR_MODES.map(setting => (
              <RadioGroup.Option
                key={setting}
                value={setting}
                className="relative inline-flex items-center cursor-pointer focus:outline-none"
              >
                {({ active, checked }) => (
                  <>
                    <span
                      className={classNames(
                        checked
                          ? 'bg-indigo-600 border-transparent'
                          : 'bg-white border-gray-300',
                        active ? 'ring-2 ring-offset-2 ring-indigo-500' : '',
                        'h-4 w-4 mt-1 cursor-pointer rounded-full border flex items-center justify-center'
                      )}
                      aria-hidden="true"
                    >
                      <span className="rounded-full bg-white w-1.5 h-1.5" />
                    </span>
                    <div className="ml-2 flex flex-col">
                      <RadioGroup.Label
                        as="span"
                        className={classNames(
                          checked ? 'text-gray-800' : 'text-gray-600',
                          'block text-sm font-medium'
                        )}
                      >
                        {setting}
                      </RadioGroup.Label>
                    </div>
                  </>
                )}
              </RadioGroup.Option>
            ))}
          </div>
        </RadioGroup>
      </div>

      <div>
        <RadioGroup value={tabSize} onChange={onTabSizeChange}>
          <RadioGroup.Label className="text-[0.92rem] font-medium text-gray-700">
            Tab Size
          </RadioGroup.Label>
          <div className="bg-white rounded-md space-x-4">
            {[2, 4, 8].map(setting => (
              <RadioGroup.Option
                key={setting}
                value={setting}
                className="relative inline-flex items-center cursor-pointer focus:outline-none"
              >
                {({ active, checked }) => (
                  <>
                    <span
                      className={classNames(
                        checked
                          ? 'bg-indigo-600 border-transparent'
                          : 'bg-white border-gray-300',
                        active ? 'ring-2 ring-offset-2 ring-indigo-500' : '',
                        'h-4 w-4 mt-1 cursor-pointer rounded-full border flex items-center justify-center'
                      )}
                      aria-hidden="true"
                    >
                      <span className="rounded-full bg-white w-1.5 h-1.5" />
                    </span>
                    <div className="ml-2 flex flex-col">
                      <RadioGroup.Label
                        as="span"
                        className={classNames(
                          checked ? 'text-gray-800' : 'text-gray-600',
                          'block text-sm font-medium'
                        )}
                      >
                        {setting}
                      </RadioGroup.Label>
                    </div>
                  </>
                )}
              </RadioGroup.Option>
            ))}
          </div>
        </RadioGroup>
      </div>

      <div>
        <RadioGroup value={lightMode} onChange={onLightModeChange}>
          <RadioGroup.Label className="text-[0.92rem] font-medium text-gray-700">
            Theme
          </RadioGroup.Label>
          <div className="bg-white rounded-md space-x-4">
            {[false, true].map(setting => (
              <RadioGroup.Option
                key={setting ? 'Light' : 'Dark'}
                value={setting}
                className="relative inline-flex items-center cursor-pointer focus:outline-none"
              >
                {({ active, checked }) => (
                  <>
                    <span
                      className={classNames(
                        checked
                          ? 'bg-indigo-600 border-transparent'
                          : 'bg-white border-gray-300',
                        active ? 'ring-2 ring-offset-2 ring-indigo-500' : '',
                        'h-4 w-4 mt-1 cursor-pointer rounded-full border flex items-center justify-center'
                      )}
                      aria-hidden="true"
                    >
                      <span className="rounded-full bg-white w-1.5 h-1.5" />
                    </span>
                    <div className="ml-2 flex flex-col">
                      <RadioGroup.Label
                        as="span"
                        className={classNames(
                          checked ? 'text-gray-800' : 'text-gray-600',
                          'block text-sm font-medium'
                        )}
                      >
                        {setting ? 'Light' : 'Dark'}
                      </RadioGroup.Label>
                    </div>
                  </>
                )}
              </RadioGroup.Option>
            ))}
          </div>
        </RadioGroup>
      </div>
      <div>
        <RadioGroup
          value={manualSubmission}
          onChange={onManualSubmissionChange}
        >
          <RadioGroup.Label className="text-[0.92rem] font-medium text-gray-700">
            Preferred submission mode
          </RadioGroup.Label>
          <div className="bg-white rounded-md space-x-4">
            {[false, true].map(setting => (
              <RadioGroup.Option
                key={setting ? 'Manual' : 'Automatic'}
                value={setting}
                className="relative inline-flex items-center cursor-pointer focus:outline-none"
              >
                {({ active, checked }) => (
                  <>
                    <span
                      className={classNames(
                        checked
                          ? 'bg-indigo-600 border-transparent'
                          : 'bg-white border-gray-300',
                        active ? 'ring-2 ring-offset-2 ring-indigo-500' : '',
                        'h-4 w-4 mt-1 cursor-pointer rounded-full border flex items-center justify-center'
                      )}
                      aria-hidden="true"
                    >
                      <span className="rounded-full bg-white w-1.5 h-1.5" />
                    </span>
                    <div className="ml-2 flex flex-col">
                      <RadioGroup.Label
                        as="span"
                        className={classNames(
                          checked ? 'text-gray-800' : 'text-gray-600',
                          'block text-sm font-medium'
                        )}
                      >
                        {setting ? 'Manual' : 'Automatic'}
                      </RadioGroup.Label>
                    </div>
                  </>
                )}
              </RadioGroup.Option>
            ))}
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
