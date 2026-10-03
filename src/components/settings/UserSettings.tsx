import React, { useState } from 'react';
import { EditorMode, Language, LANGUAGES } from '../../context/UserContext';
import { RadioGroupContents } from './RadioGroupContents';
import TemplateCodeSettings from './TemplateCodeSettings';
import {
  MAX_FONT_SIZE_EDITOR,
  MIN_FONT_SIZE_EDITOR,
} from '../../constants/editorConstants';
import {
  ChevronDownIcon,
  CodeBracketIcon as SolidCodeBracketIcon,
  DocumentIcon as SolidDocumentIcon,
  SparklesIcon as SolidSparklesIcon,
  UserIcon as SolidUserIcon,
} from '@heroicons/react/20/solid';
import {
  CodeBracketIcon as OutlineCodeBracketIcon,
  DocumentIcon as OutlineDocumentIcon,
  SparklesIcon as OutlineSparklesIcon,
  UserIcon as OutlineUserIcon,
} from '@heroicons/react/24/outline';
import {
  DEFAULT_LSP_MODES,
  LSP_LANGUAGES,
  type LspPreferences,
} from '../editor/lsp/preferences';

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
          className="block text-[0.92rem] text-content-secondary"
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
          className="block text-[0.92rem] text-content-secondary"
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
          className="block text-[0.92rem] text-content-secondary"
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
          className="block text-[0.92rem] text-content-secondary"
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
  lspPreferences,
  onLspPreferencesChange,
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
  lspPreferences: LspPreferences;
  onLspPreferencesChange: (lspPreferences: LspPreferences) => void;
  manualSubmission: boolean;
  onManualSubmissionChange: (manualSubmission: boolean) => void;
  templateCode: Partial<Record<Language, string>>;
  onTemplateCodeChange: (defaults: Partial<Record<Language, string>>) => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
}): JSX.Element {
  const [submenu, setSubmenu] = useState<Submenu>('userdata');
  const sectionButtonClass =
    'flex items-center justify-between border border-line bg-panel px-3 py-2 text-sm text-content hover:bg-surface-hover';
  const joinedSectionButtonClass =
    'flex items-center justify-between border border-t-0 border-line bg-panel px-3 py-2 text-sm text-content hover:bg-surface-hover';
  const sectionContentClass = 'border border-t-0 border-line p-4';
  const spacedSectionContentClass =
    'space-y-4 border border-t-0 border-line p-4';
  const UserDataIcon = submenu === 'userdata' ? SolidUserIcon : OutlineUserIcon;
  const CodeSettingsIcon =
    submenu === 'codesettings' ? SolidCodeBracketIcon : OutlineCodeBracketIcon;
  const VisualSettingsIcon =
    submenu === 'visualsettings' ? SolidSparklesIcon : OutlineSparklesIcon;
  const FileTemplatesIcon =
    submenu === 'templates' ? SolidDocumentIcon : OutlineDocumentIcon;

  return (
    <div>
      <div className="flex flex-col bg-panel-muted text-sm text-content">
        <button
          className={sectionButtonClass}
          onClick={() =>
            setSubmenu(val => (val === 'userdata' ? '' : 'userdata'))
          }
        >
          <span className="flex items-center">
            <UserDataIcon className="mr-2 inline h-4 w-4" />
            User data
          </span>
          <ChevronDownIcon
            className={`inline h-4 w-4 ${
              submenu !== 'userdata' ? 'rotate-0' : 'rotate-180'
            } transition-transform duration-200`}
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
            <CodeSettingsIcon className="mr-2 inline h-4 w-4" />
            Code settings
          </span>
          <ChevronDownIcon
            className={`inline h-4 w-4 ${
              submenu !== 'codesettings' ? 'rotate-0' : 'rotate-180'
            } transition-transform duration-200`}
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
            <div>
              <div className="text-content-secondary text-sm">
                Language services
              </div>
              <div className="mt-2 space-y-3">
                {LSP_LANGUAGES.map(language => (
                  <div key={language}>
                    <RadioGroupContents<'default' | 'local' | 'remote'>
                      title={language === 'cpp' ? 'C++' : 'Python'}
                      value={lspPreferences[language] ?? 'default'}
                      horizontal
                      onChange={value =>
                        onLspPreferencesChange({
                          ...lspPreferences,
                          [language]: value === 'default' ? null : value,
                        })
                      }
                      options={[
                        {
                          label: `Default (${DEFAULT_LSP_MODES[language] === 'local' ? 'Local' : 'Remote'})`,
                          value: 'default',
                        },
                        { label: 'Remote', value: 'remote' },
                        { label: 'This device', value: 'local' },
                      ]}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-sm text-content-secondary">
                Reload the editor page to apply changes.
              </p>
            </div>
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
            <VisualSettingsIcon className="mr-2 inline h-4 w-4" />
            Visual settings
          </span>
          <ChevronDownIcon
            className={`inline h-4 w-4 ${
              submenu !== 'visualsettings' ? 'rotate-0' : 'rotate-180'
            } transition-transform duration-200`}
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
                className="block text-[0.92rem] text-content-secondary"
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
                  const value = e.currentTarget.valueAsNumber;
                  if (Number.isNaN(value)) {
                    return;
                  }
                  onFontSizeChange(Math.round(value));
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
            <FileTemplatesIcon className="mr-2 inline h-4 w-4" />
            File templates
          </span>
          <ChevronDownIcon
            className={`inline h-4 w-4 ${
              submenu !== 'templates' ? 'rotate-0' : 'rotate-180'
            } transition-transform duration-200`}
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
