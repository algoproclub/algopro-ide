import React, { useState } from 'react';
import { EditorMode, Language, LANGUAGES } from '../../context/UserContext';
import { RadioGroupContents } from './RadioGroupContents';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import TemplateCodeSettings from './TemplateCodeSettings';
import {
  MAX_FONT_SIZE_EDITOR,
  MIN_FONT_SIZE_EDITOR,
} from '../../scripts/updateSettings';

const EDITOR_MODES = ['Normal', 'Vim' /*'Emacs'*/];

export const SUBMENUS = [
  'main',
  'userdata',
  'codesettings',
  'visualsettings',
  'filetemplates',
];

export type Submenu = (typeof SUBMENUS)[number];

const UserDataSettings = ({
  name,
  onNameChange,
  cfUsername,
  onCfUsernameChange,
  atcoderUsername,
  onAtcoderUsernameChange,
  discordID,
  onDiscordIDChange,
}: {
  name: string;
  onNameChange: (name: string) => void;
  cfUsername: string;
  onCfUsernameChange: (cfUsername: string) => void;
  atcoderUsername: string;
  onAtcoderUsernameChange: (atcoderUsername: string) => void;
  discordID: string;
  onDiscordIDChange: (discordID: string) => void;
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor={`name`}
          className="block text-[0.92rem] text-[color:var(--text-secondary)]"
        >
          Username
        </label>
        <div>
          <input
            type="text"
            name={`name`}
            id={`name`}
            className="text-input"
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
          className="block text-[0.92rem] text-[color:var(--text-secondary)]"
        >
          Codeforces username
        </label>
        <div>
          <input
            type="text"
            name={`cf-username`}
            id={`cf-username`}
            className="text-input"
            value={cfUsername}
            onChange={e => {
              onCfUsernameChange(e.target.value);
            }}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor={`atcoder-username`}
          className="block text-[0.92rem] text-[color:var(--text-secondary)]"
        >
          AtCoder username
        </label>
        <div>
          <input
            type="text"
            name={`atcoder-username`}
            id={`atcoder-username`}
            className="text-input"
            value={atcoderUsername}
            onChange={e => {
              onAtcoderUsernameChange(e.target.value);
            }}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor={`discord-username`}
          className="block text-[0.92rem] text-[color:var(--text-secondary)]"
        >
          Discord user ID
        </label>
        <div>
          <input
            type="text"
            name={`discord-username`}
            id={`discord-username`}
            className="text-input"
            value={discordID}
            onChange={e => {
              onDiscordIDChange(e.target.value);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default function UserSettings({
  name,
  onNameChange,
  cfUsername,
  onCfUsernameChange,
  atcoderUsername,
  onAtcoderUsernameChange,
  discordID,
  onDiscordIDChange,
  defaultLanguage,
  onDefaultLanguageChange,
  editorMode,
  onEditorModeChange,
  tabSize,
  onTabSizeChange,
  fontSize,
  onFontSizeChange,
  lightMode,
  onLightModeChange,
  rainbowIndent,
  onRainbowIndentChange,
  manualSubmission,
  onManualSubmissionChange,
  templateCode,
  onTemplateCodeChange,
  language,
  onLanguageChange,
}: {
  name: string;
  onNameChange: (name: string) => void;
  cfUsername: string;
  onCfUsernameChange: (cfUsername: string) => void;
  atcoderUsername: string;
  onAtcoderUsernameChange: (atcoderUsername: string) => void;
  discordID: string;
  onDiscordIDChange: (discordID: string) => void;
  defaultLanguage: Language;
  onDefaultLanguageChange: (lang: Language) => void;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
  tabSize: number;
  onTabSizeChange: (tabSize: number) => void;
  fontSize: number;
  onFontSizeChange: (fontSize: number) => void;
  lightMode: boolean;
  onLightModeChange: (lightMode: boolean) => void;
  rainbowIndent: boolean;
  onRainbowIndentChange: (rainbowIndent: boolean) => void;
  manualSubmission: boolean;
  onManualSubmissionChange: (manualSubmission: boolean) => void;
  templateCode: Partial<Record<Language, string>>;
  onTemplateCodeChange: (defaults: Partial<Record<Language, string>>) => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
}): JSX.Element {
  const [submenu, setSubmenu] = useState<Submenu>('userdata');
  const sectionButtonClass =
    'flex items-center justify-between bg-[var(--panel-bg)] py-2 px-3 border border-[var(--border-color)] text-[color:var(--text-primary)] hover:bg-[var(--hover-bg)] text-sm';
  const joinedSectionButtonClass =
    'flex items-center justify-between bg-[var(--panel-bg)] py-2 px-3 border border-t-0 border-[var(--border-color)] text-[color:var(--text-primary)] hover:bg-[var(--hover-bg)] text-sm';
  const sectionContentClass =
    'p-4 border border-t-0 border-[var(--border-color)]';
  const spacedSectionContentClass =
    'space-y-4 p-4 border border-t-0 border-[var(--border-color)]';

  return (
    <div>
      <div className="flex flex-col text-sm text-[color:var(--text-primary)] bg-[var(--panel-bg-alt)]">
        <button
          className={sectionButtonClass}
          onClick={() =>
            setSubmenu(val => (val === 'userdata' ? '' : 'userdata'))
          }
        >
          <span className="flex items-center">
            <FontAwesomeIcon
              icon={{ prefix: 'fas', iconName: 'user' }}
              className="w-3.5 h-3.5 inline mr-2"
            />
            User data
          </span>
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'chevron-down' }}
            className={`w-3.5 h-3.5 inline ${
              submenu !== 'userdata' ? 'rotate-0' : 'rotate-180'
            } transition duration-200`}
          />
        </button>
        {submenu === 'userdata' && (
          <div className={sectionContentClass}>
            <UserDataSettings
              name={name}
              onNameChange={onNameChange}
              cfUsername={cfUsername}
              onCfUsernameChange={onCfUsernameChange}
              atcoderUsername={atcoderUsername}
              onAtcoderUsernameChange={onAtcoderUsernameChange}
              discordID={discordID}
              onDiscordIDChange={onDiscordIDChange}
            />
          </div>
        )}
        <button
          className={joinedSectionButtonClass}
          onClick={() =>
            setSubmenu(val => (val === 'codesettings' ? '' : 'codesettings'))
          }
        >
          <span className="flex items-center">
            <FontAwesomeIcon
              icon={{ prefix: 'fas', iconName: 'code' }}
              className="w-3.5 h-3.5 inline mr-2"
            />
            Code settings
          </span>
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'chevron-down' }}
            className={`w-3.5 h-3.5 inline ${
              submenu !== 'codesettings' ? 'rotate-0' : 'rotate-180'
            } transition duration-200`}
          />
        </button>
        {submenu === 'codesettings' && (
          <div className={spacedSectionContentClass}>
            <RadioGroupContents
              title="Preferred language"
              value={defaultLanguage}
              onChange={onDefaultLanguageChange}
              options={LANGUAGES}
            />
            <RadioGroupContents
              title="Preferred submission mode"
              value={manualSubmission}
              onChange={onManualSubmissionChange}
              options={[
                { label: 'Manual', value: true },
                { label: 'Automatic', value: false },
              ]}
            />
          </div>
        )}
        <button
          className={joinedSectionButtonClass}
          onClick={() =>
            setSubmenu(val =>
              val === 'visualsettings' ? '' : 'visualsettings'
            )
          }
        >
          <span className="flex items-center">
            <FontAwesomeIcon
              icon={{ prefix: 'fas', iconName: 'wand-magic-sparkles' }}
              className="w-3.5 h-3.5 inline mr-2"
            />
            Visual settings
          </span>
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'chevron-down' }}
            className={`w-3.5 h-3.5 inline ${
              submenu !== 'visualsettings' ? 'rotate-0' : 'rotate-180'
            } transition duration-200`}
          />
        </button>
        {submenu === 'visualsettings' && (
          <div className={spacedSectionContentClass}>
            <RadioGroupContents
              title="Editor mode"
              value={editorMode}
              onChange={onEditorModeChange}
              options={EDITOR_MODES.map(val => {
                return { label: val, value: val as EditorMode };
              })}
            />
            <RadioGroupContents
              title="Editor theme"
              value={lightMode}
              onChange={onLightModeChange}
              options={[
                { label: 'Dark', value: false },
                { label: 'Light', value: true },
              ]}
            />
            <RadioGroupContents
              title="Rainbow indent guides (not working on mobile phones)"
              value={rainbowIndent}
              onChange={onRainbowIndentChange}
              options={[
                { label: 'Off', value: false },
                { label: 'On', value: true },
              ]}
            />
            <RadioGroupContents
              title="Tab size"
              value={tabSize}
              onChange={onTabSizeChange}
              options={[2, 4, 8].map(val => {
                return { label: val + ' chars', value: val };
              })}
            />
            <div>
              <label
                htmlFor={`fontSize`}
                className="block text-[0.92rem] text-[color:var(--text-secondary)]"
              >
                Font size (pixels)
              </label>
              <input
                type="number"
                name={`fontSize`}
                id={`fontSize`}
                className="text-input"
                min={MIN_FONT_SIZE_EDITOR}
                max={MAX_FONT_SIZE_EDITOR}
                value={fontSize}
                onChange={e => {
                  onFontSizeChange(Number.parseInt(e.target.value));
                }}
              />
            </div>
          </div>
        )}
        <button
          className={joinedSectionButtonClass}
          onClick={() =>
            setSubmenu(val => (val === 'templates' ? '' : 'templates'))
          }
        >
          <span className="flex items-center">
            <FontAwesomeIcon
              icon={{ prefix: 'fas', iconName: 'file' }}
              className="w-3.5 h-3.5 inline mr-2"
            />
            File templates
          </span>
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'chevron-down' }}
            className={`w-3.5 h-3.5 inline ${
              submenu !== 'templates' ? 'rotate-0' : 'rotate-180'
            } transition duration-200`}
          />
        </button>
        {submenu === 'templates' && (
          <div className={sectionContentClass}>
            <TemplateCodeSettings
              templateCode={templateCode}
              onTemplateCodeChange={onTemplateCodeChange}
              language={language}
              onLanguageChange={onLanguageChange}
              lightMode={lightMode}
            />
          </div>
        )}
      </div>
    </div>
  );
}
