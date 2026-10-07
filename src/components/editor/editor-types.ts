import type { EditorView } from '@codemirror/view';
import type * as MonacoApi from 'monaco-editor';
import type * as Y from 'yjs';
import type * as awarenessProtocol from 'y-protocols/awareness';

export type EditorTheme = 'dark' | 'light';

export type AlgoProMonacoEditor = ReturnType<typeof MonacoApi.editor.create> & {
  setLineHighlight: (line: number) => void;
  clearLineHighlight: () => void;
};

export interface SharedEditorOptions {
  automaticLayout?: boolean;
  insertSpaces?: boolean;
  readOnly?: boolean;
  tabSize?: number;
  fontSize?: number;
}

export interface EditorLspOptions {
  compilerOptions: string | null;
}

export interface EditorYjsInfo {
  documentId: string;
  path?: string;
  yjsText: Y.Text;
  yjsAwareness: awarenessProtocol.Awareness;
}

interface BaseEditorHandle {
  clearLineHighlight: () => void;
  getValue: () => string;
  getLineContent: (lineNumber: number) => string | undefined;
  focus: () => void;
  kind: 'codemirror' | 'monaco';
  layout: () => void;
  redo: () => void;
  setLineHighlight: (lineNumber: number) => void;
  setValue: (value: string) => void;
  undo: () => void;
}

export interface MonacoEditorHandle extends BaseEditorHandle {
  kind: 'monaco';
  raw: AlgoProMonacoEditor;
}

export interface CodemirrorEditorHandle extends BaseEditorHandle {
  kind: 'codemirror';
  raw: EditorView;
}

export type EditorHandle = CodemirrorEditorHandle | MonacoEditorHandle;

export function isCodemirrorEditorHandle(
  handle: EditorHandle
): handle is CodemirrorEditorHandle {
  return handle.kind === 'codemirror';
}

export function isMonacoEditorHandle(
  handle: EditorHandle
): handle is MonacoEditorHandle {
  return handle.kind === 'monaco';
}

export interface SharedEditorProps {
  className?: string;
  editorOptions?: SharedEditorOptions;
  language?: string;
  lspOptions?: EditorLspOptions | null;
  onChange?: (val: string) => void;
  onReady?: (handle: EditorHandle) => void;
  path?: string;
  theme?: EditorTheme;
  value?: string;
  vim?: boolean;
  yjsInfo?: EditorYjsInfo | null;
}

export interface MonacoEditorProps {
  monacoOptions?: MonacoApi.editor.IStandaloneEditorConstructionOptions;
  onBeforeDispose?: () => void;
  rainbowIndent?: boolean;
  saveViewState?: boolean;
}

export type EditorProps = SharedEditorProps & MonacoEditorProps;
