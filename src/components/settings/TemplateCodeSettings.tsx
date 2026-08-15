import React from 'react';
import { Language, LANGUAGES } from '../../context/UserContext';
import LazyCodeMirrorEditor from '../editor/CodemirrorEditor/LazyCodemirrorEditor';
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
            className="flex-shrink-0 px-4 py-2 bg-red-600 shadow-sm text-sm font-medium rounded-md text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
      {/* FIXME: This here is a huge hack:
       *
       * - The monaco component uses a bunch of global state (LSP, color scheme),
       *   so creating this editor would mess with the main editor.
       * - We can't add a *different* model to the editor when changing languages,
       *   only replace `value`, so undo/redo history is shared between languages.
       * - We could create a new editor instance when changing languages, but that
       *   still wouldn't solve the undo/redo issue, and the UI would flash when
       *   a new editor is rendered.
       */}
      <div className="h-[18em] sm:h-50vh border border-[var(--border-color)] focus:border-[var(--accent)]">
        <LazyCodeMirrorEditor
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
