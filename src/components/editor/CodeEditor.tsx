// A code editor that uses either Monaco or Codemirror 6 depending on whether the user is on mobile or not

import dynamic from 'next/dynamic';
import LoadingIndicator from '../LoadingIndicator';
import type { EditorProps } from './editor-types';

type EditorModule =
  | typeof import('./CodemirrorEditor/CodemirrorEditor')
  | typeof import('./MonacoEditor/MonacoEditor');

let editorPromise: Promise<EditorModule> | undefined;

const loadCodeEditor = () =>
  (editorPromise ??= window.matchMedia('(pointer: coarse)').matches
    ? import('./CodemirrorEditor/CodemirrorEditor')
    : import('./MonacoEditor/MonacoEditor'));

export const preloadCodeEditor = () => {
  if (typeof window !== 'undefined') {
    void loadCodeEditor().then(editorModule => {
      if ('initialize' in editorModule) {
        void editorModule.initialize();
      }
    });
  }
};

const CodeEditor = dynamic<EditorProps>(loadCodeEditor, {
  ssr: false,
  loading: () => (
    <div
      className="px-4 py-3 flex items-center justify-between"
      data-testid="editorLoadingMessage"
    >
      <LoadingIndicator className="mr-2 h-4 w-4 text-content-muted" />
      <span className="text-content-muted">Loading…</span>
    </div>
  ),
});

export default CodeEditor;
