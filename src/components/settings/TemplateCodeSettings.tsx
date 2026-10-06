import React from 'react';
import { Language, LANGUAGES } from '../../context/UserContext';
import CodemirrorEditor from '../editor/CodemirrorEditor/CodemirrorEditor';
import defaultCode from '../../scripts/defaultCode';
import Dropdown from '../Dropdown';

export default function TemplateCodeSettings({
  templateCode,
  onTemplateCodeChange,
  language,
  onLanguageChange,
  lightMode,
}: {
  templateCode: Partial<Record<Language, string>>;
  onTemplateCodeChange: (defaults: Partial<Record<Language, string>>) => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  lightMode: boolean;
}): JSX.Element {
  return (
    <div>
      <div className="flex flex-row items-center mb-3">
        <div className="w-full space-x-2 flex items-end">
          <Dropdown
            items={LANGUAGES}
            label="Language"
            selected={language}
            setSelected={onLanguageChange}
          />
          <button
            type="button"
            className="ui-button flex-shrink-0 border-transparent bg-danger px-4 py-2 text-white hover:brightness-90"
            onClick={() => {
              onTemplateCodeChange({
                ...templateCode,
                [language]: defaultCode[language],
              });
            }}
          >
            Reset to default
          </button>
        </div>
      </div>
      {/* We use Codemirror here as it's lightweight and doesn't mess with global state like Monaco does. */}
      <div className="h-[18em] border border-line focus-within:border-line-strong sm:h-50vh">
        <CodemirrorEditor
          theme={lightMode ? 'light' : 'dark'}
          language={{ cpp: 'cpp', java: 'java', py: 'python' }[language]}
          onChange={value =>
            onTemplateCodeChange({ ...templateCode, [language]: value })
          }
          value={templateCode[language]}
          saveViewState={false}
          editorOptions={{
            readOnly: false,
            automaticLayout: false,
            insertSpaces: true,
          }}
        />
      </div>
    </div>
  );
}
