import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { useAtom } from 'jotai';
import {
  mainCodemirrorEditorAtom,
  mainMonacoEditorAtom,
} from '../../atoms/workspace';
import { LazyRealtimeEditor } from '../RealtimeEditor/LazyRealtimeEditor';
import { useEditorContext } from '../../context/EditorContext';
import useUserPermission from '../../hooks/useUserPermission';
import { useUserContext } from '../../context/UserContext';
import { problemAtom } from '../../atoms/workspaceUI';
import { EditorHandle, isMonacoEditorHandle } from '../editor/editor-types';

export const CodeInterface = ({
  className,
}: {
  className?: string;
}): JSX.Element => {
  const { fileData } = useEditorContext();
  const [problem] = useAtom(problemAtom);
  const problemDataIsReady = fileData.problem
    ? problem?.platform === fileData.problem.platform &&
      problem.id === fileData.problem.id
    : problem === null;
  const lang = fileData.settings.language;
  const permission = useUserPermission();
  const readOnly = !(permission === 'OWNER' || permission === 'READ_WRITE');
  const [editorHandle, setEditorHandle] = useState<EditorHandle | null>(null);
  const [, setMainMonacoEditor] = useAtom(mainMonacoEditorAtom);
  const [, setMainCodemirrorEditor] = useAtom(mainCodemirrorEditorAtom);

  // I think we need these useEffect()s here because otherwise when the component
  // is unmounted, the mainMonacoEditorAtom/mainCodemirrorEditorAtom will still
  // be set
  useEffect(() => {
    if (!editorHandle) {
      return;
    }

    if (isMonacoEditorHandle(editorHandle)) {
      setMainMonacoEditor(editorHandle.raw);
      return () => {
        setMainMonacoEditor(null);
      };
    }

    setMainCodemirrorEditor(editorHandle.raw);

    return () => {
      setMainCodemirrorEditor(null);
    };
  }, [editorHandle, setMainCodemirrorEditor, setMainMonacoEditor]);

  const {
    userData: { tabSize, fontSize, lightMode, rainbowIndent },
    templateCode,
  } = useUserContext();

  return (
    <div
      className={classNames(
        'flex flex-col bg-[var(--panel-bg)] text-[color:var(--text-primary)]',
        className
      )}
    >
      <div className="flex-1 overflow-hidden">
        <LazyRealtimeEditor
          theme={lightMode ? 'light' : 'dark'}
          rainbowIndent={rainbowIndent}
          language={{ cpp: 'cpp', java: 'java', py: 'python' }[lang]}
          path={`myfile.${lang}`}
          editorOptions={{
            insertSpaces: false,
            readOnly,
            tabSize,
            fontSize,
          }}
          onReady={handle => {
            setEditorHandle(handle);
            if (isMonacoEditorHandle(handle)) {
              handle.focus();
            }
          }}
          defaultValue={
            problemDataIsReady
              ? (problem?.templateCode?.[lang] ?? templateCode[lang])
              : undefined
          }
          initializationReady={problemDataIsReady}
          yjsDocumentId={`${fileData.id}.${lang}`}
          useEditorWithVim={true}
          lspOptions={{
            compilerOptions: fileData.settings.compilerOptions[lang],
          }}
          dataTestId="code-editor"
        />
      </div>
      <p className="text-sm font-mono text-[color:var(--text-secondary)] pl-4 status-node" />
    </div>
  );
};
