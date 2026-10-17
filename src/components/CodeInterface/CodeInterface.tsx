import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { useAtom, useSetAtom } from 'jotai';
import { mainEditorHandleAtom } from '../../atoms/workspace';
import RealtimeEditor from '../RealtimeEditor/RealtimeEditor';
import { useEditorContext } from '../../context/EditorContext';
import useUserPermission from '../../hooks/useUserPermission';
import { useUserContext } from '../../context/UserContext';
import { problemAtom } from '../../atoms/workspaceUI';
import { EditorHandle } from '../editor/editor-types';
import { useMediaQuery } from '../../hooks/useMediaQuery';

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
  const setMainEditorHandle = useSetAtom(mainEditorHandleAtom);
  const isTouchDevice = useMediaQuery('(pointer: coarse)');

  useEffect(() => {
    if (!editorHandle) return;

    setMainEditorHandle(editorHandle);
    return () => {
      setMainEditorHandle(null);
    };
  }, [editorHandle, setMainEditorHandle]);

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
        <RealtimeEditor
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
            if (!isTouchDevice) handle.focus();
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
