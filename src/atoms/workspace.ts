import type { EditorView } from '@codemirror/view';
import { atom } from 'jotai';
import type {
  AlgoProMonacoEditor,
  EditorHandle,
} from '../components/editor/editor-types';

// Loading
export const loadingAtom = atom(true);

export const inputMonacoEditorAtom = atom<AlgoProMonacoEditor | null>(null);

export const inputCodemirrorEditorAtom = atom<EditorView | null>(null);
export const mainEditorHandleAtom = atom<EditorHandle | null>(null);

export const isLineHighlightSetAtom = atom<boolean>(false);
export const savedEditorValue = atom<string | null>(null);

// returns a function that can be called to get the value of the editor
export const mainEditorValueAtom = atom(get => {
  return get(mainEditorHandleAtom)?.getValue ?? null;
});

// returns a function that can be called to get the value of the editor
export const inputEditorValueAtom = atom(get => {
  const monacoEditor = get(inputMonacoEditorAtom);
  const codemirrorEditor = get(inputCodemirrorEditorAtom);
  if (monacoEditor && codemirrorEditor) {
    console.error('Both input editors are defined, this should not happen!');
  }
  if (!monacoEditor && !codemirrorEditor) {
    return null;
  }
  return () => {
    if (monacoEditor) {
      return monacoEditor.getValue();
    }
    return codemirrorEditor!.state.doc.toString();
  };
});
