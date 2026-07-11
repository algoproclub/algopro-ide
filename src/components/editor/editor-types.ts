import type { EditorView } from '@codemirror/view';
import type * as MonacoApi from 'monaco-editor';
import type * as Y from 'yjs';
import type * as awarenessProtocol from 'y-protocols/awareness';

export type EditorTheme = 'dark' | 'light';

/** A single line the AI Debug feature wants to highlight. */
export type BugHighlightMark = { line: number; hoverMessage?: string };

export type AlgoProMonacoEditor = ReturnType<typeof MonacoApi.editor.create> & {
  setLineHighlight: (line: number) => void;
  clearLineHighlight: () => void;
  /** AI Debug feature: highlight the given lines as suspected bugs. */
  setBugHighlights: (marks: BugHighlightMark[]) => void;
  clearBugHighlights: () => void;
};

export interface SharedEditorOptions {
  automaticLayout?: boolean;
  insertSpaces?: boolean;
  readOnly?: boolean;
  tabSize?: number;
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
  getValue: () => string;
  focus: () => void;
  kind: 'codemirror' | 'monaco';
  layout: () => void;
}

export interface MonacoEditorHandle extends BaseEditorHandle {
  clearLineHighlight: () => void;
  kind: 'monaco';
  raw: AlgoProMonacoEditor;
  setLineHighlight: (line: number) => void;
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
