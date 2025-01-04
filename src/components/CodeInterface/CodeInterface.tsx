import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { useAtom } from 'jotai';
import {
  mainCodemirrorEditorAtom,
  mainMonacoEditorAtom,
} from '../../atoms/workspace';
import { LazyRealtimeEditor } from '../RealtimeEditor/LazyRealtimeEditor';
import type * as monaco from 'monaco-editor';
import { useEditorContext } from '../../context/EditorContext';
import useUserPermission from '../../hooks/useUserPermission';
import { useUserContext } from '../../context/UserContext';
import { EditorView } from '@uiw/react-codemirror';
import { problemAtom } from '../../atoms/workspaceUI';
import { AlgoProMonacoEditor } from '../editor/MonacoEditor/monaco-editor-types';

export const CodeInterface = ({
  className,
}: {
  className?: string;
}): JSX.Element => {
  const { fileData } = useEditorContext();
  const [problem] = useAtom(problemAtom);
  const lang = fileData.settings.language;
  const permission = useUserPermission();
  const readOnly = !(permission === 'OWNER' || permission === 'READ_WRITE');
  const [editor, setEditor] = useState<AlgoProMonacoEditor | null>(null);
  const [codemirrorEditor, setCodemirrorEditor] = useState<EditorView | null>(
    null
  );
  const [, setMainMonacoEditor] = useAtom(mainMonacoEditorAtom);
  const [, setMainCodemirrorEditor] = useAtom(mainCodemirrorEditorAtom);

  // I think we need these useEffect()s here because otherwise when the component
  // is unmounted, the mainMonacoEditorAtom/mainCodemirrorEditorAtom will still
  // be set
  useEffect(() => {
    if (editor) {
      setMainMonacoEditor(editor);
      return () => {
        setMainMonacoEditor(null);
      };
    }
  }, [editor, setMainMonacoEditor]);

  useEffect(() => {
    if (codemirrorEditor) {
      setMainCodemirrorEditor(codemirrorEditor);

      // @ts-expect-error: this is used by e2e/helpers.ts to set the value of the main codemirror editor
      window['TEST_mainCodemirrorEditor'] = codemirrorEditor;

      return () => {
        setMainCodemirrorEditor(null);
        // @ts-expect-error: this is used by e2e/helpers.ts to set the value of the main codemirror editor
        window['TEST_mainCodemirrorEditor'] = null;
      };
    }
  }, [codemirrorEditor, setMainCodemirrorEditor]);

  const {
    userData: { tabSize, lightMode },
    templateCode,
  } = useUserContext();

  return (
    <div
      className={classNames(
        'bg-[#1E1E1E] text-gray-200 flex flex-col',
        className
      )}
    >
      <div className="flex-1 overflow-hidden">
        {problem !== undefined && (
          <LazyRealtimeEditor
            theme={lightMode ? 'light' : 'dark'}
            language={{ cpp: 'cpp', java: 'java', py: 'python' }[lang]}
            path={`myfile.${lang}`}
            options={
              {
                minimap: { enabled: false },
                automaticLayout: false,
                tabSize: tabSize,
                insertSpaces: false,
                readOnly,
                'bracketPairColorization.enabled': true, // monaco doesn't expect an IBracketPairColorizationOptions

                // this next option is to prevent annoying autocompletes
                // ex. type return space and it adds two spaces + semicolon
                // ex. type vecto< and it autocompletes weirdly
                acceptSuggestionOnCommitCharacter: false,
                // suggestOnTriggerCharacters: false,
              } as monaco.editor.IEditorOptions
            }
            onMount={e => {
              setEditor(e);
              setTimeout(() => {
                e.layout();
                e.focus();
              }, 0);
            }}
            onCodemirrorMount={(view, _) => setCodemirrorEditor(view)}
            defaultValue={problem?.templateCode?.[lang] ?? templateCode[lang]}
            yjsDocumentId={`${fileData.id}.${lang}`}
            useEditorWithVim={true}
            lspEnabled={true} // at some point, maybe make this a user setting?
            dataTestId="code-editor"
          />
        )}
      </div>
      <p className="text-sm font-mono text-gray-200 pl-4 status-node" />
    </div>
  );
};
