import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import 'monaco-editor/esm/vs/editor/editor.all.js';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution.js';
import { buildWorkerDefinition } from 'monaco-editor-workers';
import { initVimMode } from 'monaco-vim';
import { MonacoServices } from 'monaco-languageclient';
import { getOrCreateModel, usePrevious, useUpdate } from './utils';
import { EditorProps } from './monaco-editor-types';
import createLSPConnection from './lsp';
import { MonacoBinding } from 'y-monaco';

buildWorkerDefinition(
  '/monaco-workers',
  new URL('', window.location.href).href,
  false
);

monaco.languages.register({
  id: 'cpp',
  extensions: ['.cpp'],
  aliases: ['cpp'],
});

MonacoServices.install(); // todo disposable here...

addEnhancedThemes();

const viewStates = new Map();

// @ts-ignore todo find a better way to do this
window.monaco = monaco;

// HACK: This uses a private API, as addKeybindingRules requires Monaco 0.34.1.
// https://github.com/microsoft/monaco-editor/issues/102#issuecomment-1282897640
const rebindAction = (
  editor: monaco.editor.IStandaloneCodeEditor,
  id: string,
  newBinding?: number
) => {
  // @ts-ignore
  editor._standaloneKeybindingService.addDynamicKeybinding(
    `-${id}`,
    undefined,
    () => {}
  );
  if (newBinding) {
    const action = editor.getAction(id);
    // @ts-ignore
    editor._standaloneKeybindingService.addDynamicKeybinding(
      id,
      newBinding,
      () => action.run()
    );
  }
};

export default function MonacoEditor({
  path,
  theme,
  options,
  saveViewState = true,
  onMount,
  onChange,
  language,
  className,
  value = '',
  onBeforeDispose,
  vim = false,
  lspEnabled = false,
  yjsInfo,
}: EditorProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [editor, setEditor] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  theme = { dark: 'vs-dark-sema', light: 'vs-sema' }[theme ?? 'dark'];

  useEffect(() => {
    const modelPath = `file:///root/${path ?? 'default'}`;

    editorRef.current = monaco.editor.create(
      ref.current!,
      {
        model: getOrCreateModel(monaco, value, language, modelPath),
        automaticLayout: true,
        theme: theme,
        lightbulb: {
          enabled: true,
        },
        language: language,
        inlayHints: {
          enabled: false,
        },
        'semanticHighlighting.enabled': true,
        ...options,
      },
      {}
    );

    // Ctrl+Enter for "Insert Line Below" conflicts with our shortcut for running code.
    rebindAction(
      editorRef.current,
      'editor.action.insertLineAfter',
      monaco.KeyMod.Alt | monaco.KeyCode.Enter
    );

    setEditor(editorRef.current);

    if (saveViewState) {
      editorRef.current.restoreViewState(viewStates.get(modelPath));
    }

    if (onMount) {
      onMount(editorRef.current, monaco);
    }

    return () => {
      if (editorRef.current) {
        if (onBeforeDispose) onBeforeDispose();

        editorRef.current.getModel()?.dispose();
        // this throws some model is already disposed error? so ig just don't?
        editorRef.current.dispose();
        editorRef.current = null;
      } else {
        console.error("Shouldn't happen??");
      }
      setEditor(null);
    };
  }, []);

  /*   useEffect(() => {
    if (lspEnabled) {
      return createLSPConnection();
    }
  }, [lspEnabled]); */

  useEffect(() => {
    if (!yjsInfo || !editor) return;
    const monacoBinding = new MonacoBinding(
      yjsInfo.yjsText,
      editor.getModel()!,
      new Set([editor]),
      yjsInfo.yjsAwareness
    );
    return () => {
      // if editorRef.current is null, then the editor was probably already destroyed
      if (editorRef.current) monacoBinding.destroy();
    };
  }, [editor, yjsInfo]);

  useEffect(() => {
    if (lspEnabled && (language === 'cpp' || language === 'python')) {
      // yikes, ugly how there's both python and py
      return createLSPConnection(language);
    }
  }, [lspEnabled, language]);

  useEffect(() => {
    if (vim) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let editorMode: any;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const statusNode = document.querySelector('.status-node');
      editorMode = initVimMode(editorRef.current, statusNode);

      return () => editorMode.dispose();
    }
  }, [vim]);

  /* Note: path update handler needs to run first. Otherwise, changing both path and language
     at the same time will result in the wrong language being used */
  const previousPath = usePrevious(path);
  useUpdate(() => {
    const model = getOrCreateModel(monaco, value, language, path ?? 'default');

    if (model !== editorRef.current!.getModel()) {
      saveViewState &&
        viewStates.set(previousPath, editorRef.current!.saveViewState());
      editorRef.current!.setModel(model);

      saveViewState &&
        editorRef.current!.restoreViewState(viewStates.get(path));
    }
  }, [path]);

  useUpdate(() => {
    if (editorRef.current!.getOption(monaco.editor.EditorOption.readOnly)) {
      editorRef.current!.setValue(value);
    } else {
      if (value !== editorRef.current!.getValue()) {
        editorRef.current!.executeEdits('', [
          {
            range: editorRef.current!.getModel()!.getFullModelRange(),
            text: value,
            forceMoveMarkers: true,
          },
        ]);

        editorRef.current!.pushUndoStop();
      }
    }
  }, [value]);

  useUpdate(() => {
    // theme is global
    monaco.editor.setTheme(theme ?? 'vs-dark-sema');
  }, [theme]);

  useUpdate(() => {
    monaco.editor.setModelLanguage(
      editorRef.current!.getModel()!,
      language ?? 'plaintext'
    );
  }, [language]);

  useUpdate(() => {
    // console.log('updating options'); // todo this runs way too often
    editorRef.current!.updateOptions(options ?? {});
  }, [options]);

  useEffect(() => {
    editorRef.current!.onDidChangeModelContent(e =>
      onChange?.(editorRef.current!.getValue())
    );
  }, [onChange]);

  return (
    <div className="flex relative h-full">
      <div className={className} ref={ref} style={{ width: '100%' }}></div>
    </div>
  );
}

// Adds special syntax highlighting for semantic tokens similarly
// to the default "Dark Modern" and "Light Modern" VSCode themes.
function addEnhancedThemes() {
  const COLORS = {
    'vs-dark': {
      function: 'dcdcaa',
      type: '4ec9b0',
      variable: '9cdcfe',
      constant: '4fc1ff',
      macro: '569cd6',
      escape: 'd7ba7d',
      hex: 'b5cea8',
    },
    vs: {
      function: '795e26',
      type: '267f99',
      variable: '001080',
      constant: '0070c1',
      macro: '0000ff',
      escape: 'ee0000',
      hex: '098658',
    },
  };

  for (const [theme, colors] of Object.entries(COLORS)) {
    monaco.editor.defineTheme(theme + '-sema', {
      // @ts-ignore
      base: theme,
      inherit: true,
      rules: [
        { token: 'function', foreground: colors.function },
        { token: 'method', foreground: colors.function },
        { token: 'operator.userDefined', foreground: colors.function },
        { token: 'class', foreground: colors.type },
        { token: 'struct', foreground: colors.type },
        { token: 'type', foreground: colors.type },
        { token: 'typeParameter', foreground: colors.type },
        { token: 'namespace', foreground: colors.type },
        { token: 'variable', foreground: colors.variable },
        { token: 'parameter', foreground: colors.variable },
        { token: 'property', foreground: colors.variable },
        { token: 'variable.readonly', foreground: colors.constant },
        { token: 'macro', foreground: colors.macro },
        { token: 'string.escape', foreground: colors.escape },
        { token: 'number.hex', foreground: colors.hex },
      ],
      encodedTokensColors: [],
      colors: {},
    });
  }
}
