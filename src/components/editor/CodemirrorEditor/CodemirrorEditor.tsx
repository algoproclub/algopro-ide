// A codemirror editor, used on mobile devices

import type { EditorView } from '@codemirror/view';
import ReactCodeMirror, { Extension } from '@uiw/react-codemirror';
import { indentUnit } from '@codemirror/language';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { githubLight } from '@uiw/codemirror-theme-github';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { python } from '@codemirror/lang-python';
import { vim } from '@replit/codemirror-vim';
import { CodemirrorEditorHandle, EditorProps } from '../editor-types';
import * as Y from 'yjs';
import useLspClient from './lsp';
import { isLspLanguage } from '../lsp/preferences';

import { useEffect, useMemo } from 'react';
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next';
import { DEFAULT_FONT_SIZE_EDITOR } from '../../../constants/editorConstants';

function createEditorHandle(view: EditorView): CodemirrorEditorHandle {
  return {
    clearLineHighlight() {},
    focus() {
      view.focus();
    },
    getValue() {
      return view.state.doc.toString();
    },
    getLineContent(lineNumber) {
      return lineNumber > 0 && lineNumber <= view.state.doc.lines
        ? view.state.doc.line(lineNumber).text
        : undefined;
    },
    kind: 'codemirror',
    layout() {},
    raw: view,
    redo() {
      yUndoManagerKeymap.find(mapping => mapping.key === 'Mod-y')?.run?.(view);
    },
    setLineHighlight() {},
    setValue(value: string) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    },
    undo() {
      yUndoManagerKeymap.find(mapping => mapping.key === 'Mod-z')?.run?.(view);
    },
  };
}

const CodemirrorEditor = (props: EditorProps): JSX.Element => {
  const documentUri = `file:///root/${props.path ?? 'default'}`;
  const lspClient = useLspClient(props.language, props.lspOptions, documentUri);

  const { yjsText, yjsAwareness } = props.yjsInfo ?? {};
  const yCollabBinding = useMemo(() => {
    if (!yjsText) return null;
    const undoManager = new Y.UndoManager(yjsText);
    return {
      undoManager,
      extension: yCollab(yjsText, yjsAwareness, { undoManager }),
    };
  }, [yjsText, yjsAwareness]);

  useEffect(() => {
    if (!yCollabBinding) return;
    return () => yCollabBinding.undoManager.destroy();
  }, [yCollabBinding]);

  const extensions = useMemo(() => {
    const extensions: Extension[] = [];
    const tabSize = props.editorOptions?.tabSize || 4;
    extensions.push(indentUnit.of(' '.repeat(tabSize)));
    if (yCollabBinding) {
      extensions.push(yCollabBinding.extension);
    }
    if (props.vim) {
      extensions.push(vim());
    }
    if (props.language && props.language !== 'plaintext') {
      if (props.language === 'cpp') {
        extensions.push(cpp());
      } else if (props.language === 'java') {
        extensions.push(java());
      } else if (props.language === 'python') {
        extensions.push(python());
      } else {
        console.error('Unknown language: ' + props.language);
      }
    }
    if (lspClient) {
      extensions.push(
        lspClient.plugin(
          documentUri,
          isLspLanguage(props.language) ? props.language : undefined
        )
      );
    }
    return extensions;
  }, [
    props.language,
    yCollabBinding,
    props.editorOptions?.tabSize,
    props.vim,
    documentUri,
    lspClient,
  ]);

  // todo: need to deal with props.editorOptions.tabSize
  return (
    <ReactCodeMirror
      // force entire component to re-mount (and re-initialize codemirror) when yjs document ID changes
      key={props.yjsInfo?.yjsText.doc?.guid}
      // yCollab() expects the editor to start with the content of the Y.Text
      // eslint-disable-next-line @typescript-eslint/no-base-to-string -- False positive:Y.Text overrides toString().
      value={yjsText ? yjsText.toString() : props.value}
      theme={props.theme === 'light' ? githubLight : vscodeDark}
      onChange={(val: string, _) => props.onChange?.(val)}
      height="100%"
      style={{
        fontSize: `${props.editorOptions?.fontSize ?? DEFAULT_FONT_SIZE_EDITOR}px`,
      }}
      readOnly={props.editorOptions?.readOnly ?? false}
      extensions={extensions}
      onCreateEditor={view => props.onReady?.(createEditorHandle(view))}
    />
  );
};

export default CodemirrorEditor;
