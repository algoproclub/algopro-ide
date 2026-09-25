import React from 'react';
import { Language, LANGUAGES } from '../../context/UserContext';
import LazyCodeMirrorEditor from '../editor/CodemirrorEditor/LazyCodemirrorEditor';
import defaultCode from '../../scripts/defaultCode';
import Dropdown from '../Dropdown';
import { Button } from '../Button';

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
          <Button
            type="button"
            variant="danger"
            className="flex-shrink-0"
            onClick={() => {
              onTemplateCodeChange({
                ...templateCode,
                [language]: defaultCode[language],
              });
            }}
          >
            Reset to default
          </Button>
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
      <div className="h-[18em] border border-line focus-within:border-line-strong sm:h-50vh">
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
