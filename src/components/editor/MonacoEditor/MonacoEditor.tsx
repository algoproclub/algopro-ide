import { useEffect, useRef, useState } from 'react';

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
import { AlgoProMonacoEditor, EditorProps } from './monaco-editor-types';
import useLSP from './lsp';
import { MonacoBinding } from 'y-monaco';

const RAINBOW_INDENT_STYLE_ID = 'algopro-rainbow-indent-styles';
const RAINBOW_INDENT_COLORS = {
  dark: [
    'rgba(150, 140, 35, 0.34)',
    'rgba(44, 110, 52, 0.34)',
    'rgba(20, 111, 112, 0.34)',
    'rgba(24, 93, 150, 0.34)',
    'rgba(91, 44, 130, 0.34)',
    'rgba(128, 34, 92, 0.34)',
  ],
  light: [
    'rgba(175, 164, 45, 0.22)',
    'rgba(52, 134, 63, 0.22)',
    'rgba(24, 138, 140, 0.22)',
    'rgba(31, 114, 184, 0.22)',
    'rgba(112, 56, 160, 0.22)',
    'rgba(153, 43, 110, 0.22)',
  ],
};

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

// @ts-expect-error todo find a better way to do this
window.monaco = monaco;

// HACK: This uses a private API, as addKeybindingRules requires Monaco 0.34.1.
// https://github.com/microsoft/monaco-editor/issues/102#issuecomment-1282897640
const rebindAction = (
  editor: monaco.editor.IStandaloneCodeEditor,
  id: string,
  newBinding?: number
) => {
  // @ts-expect-error: this is a private API until Monaco 0.34.1
  editor._standaloneKeybindingService.addDynamicKeybinding(
    `-${id}`,
    undefined,
    () => {}
  );
  if (newBinding) {
    const action = editor.getAction(id);
    // @ts-expect-error: this is a private API until Monaco 0.34.1
    editor._standaloneKeybindingService.addDynamicKeybinding(
      id,
      newBinding,
      () => action.run()
    );
  }
};

function ensureRainbowIndentStyles() {
  if (document.getElementById(RAINBOW_INDENT_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = RAINBOW_INDENT_STYLE_ID;
  style.textContent = ['dark', 'light']
    .flatMap(mode =>
      RAINBOW_INDENT_COLORS[mode as 'dark' | 'light'].map(
        (color, index) => `
          .rainbow-indent-${mode}-${index} {
            background-color: ${color};
          }

          .rainbow-indent-${mode}-${index}-edge {
            background-image:
              linear-gradient(${color}, ${color}),
              repeating-linear-gradient(
                to bottom,
                rgba(255, 255, 255, 0.30) 0 3px,
                transparent 3px 6px
              );
            background-size: calc(100% - 1px) 100%, 1px 100%;
            background-position: left top, right top;
            background-repeat: no-repeat;
          }
        `
      )
    )
    .join('\n');
  document.head.appendChild(style);
}

function computeRainbowIndentDecorations(
  editor: monaco.editor.IStandaloneCodeEditor,
  themeMode: 'dark' | 'light',
  tabSize: number
) {
  const model = editor.getModel();
  if (!model) return [];

  const decorations: monaco.editor.IModelDeltaDecoration[] = [];
  for (const visibleRange of editor.getVisibleRanges()) {
    for (
      let lineNumber = visibleRange.startLineNumber;
      lineNumber <= visibleRange.endLineNumber;
      lineNumber++
    ) {
      let visualColumn = 0;
      const line = model.getLineContent(lineNumber);
      for (let index = 0; index < line.length; index++) {
        const ch = line[index];
        if (ch !== ' ' && ch !== '\t') break;

        const level = Math.floor(visualColumn / tabSize);
        const width = ch === '\t' ? tabSize - (visualColumn % tabSize) : 1;
        visualColumn += width;
        decorations.push({
          range: new monaco.Range(lineNumber, index + 1, lineNumber, index + 2),
          options: {
            inlineClassName: `rainbow-indent-${themeMode}-${level % 6}${
              visualColumn % tabSize === 0 ? '-edge' : ''
            }`,
          },
        });
      }
    }
  }

  return decorations;
}

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
  rainbowIndent = false,
  lspOptions,
  yjsInfo,
}: EditorProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<AlgoProMonacoEditor | null>(null);
  const [editor, setEditor] = useState<AlgoProMonacoEditor | null>(null);

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
    ) as AlgoProMonacoEditor;

    // TODO: Refactor to inherit from the monaco editor instead of injecting properties
    // https://github.com/algoproclub/algopro-ide/issues/287
    editorRef.current._lineHighlight = null;
    editorRef.current._lineHighlightTimeout = null;
    editorRef.current._rainbowIndentDecorations = [];
    editorRef.current.setLineHighlight = function (line: number) {
      const model = this.getModel();
      if (!model || line < 1 || line > model.getLineCount()) {
        return;
      }

      if (this._lineHighlightTimeout) {
        clearTimeout(this._lineHighlightTimeout);
      }

      this._lineHighlight = this.deltaDecorations(
        this._lineHighlight ? [this._lineHighlight] : [],
        [
          {
            range: new monaco.Range(line, 1, line, 1),
            options: {
              isWholeLine: true,
              className: 'linked-line-highlight',
            },
          },
        ]
      )[0];
    };
    editorRef.current.clearLineHighlight = function () {
      if (this._lineHighlight === null) return;

      this._lineHighlightTimeout = setTimeout(() => {
        if (!editorRef.current) return;
        editorRef.current.deltaDecorations(
          [editorRef.current._lineHighlight!],
          []
        );
        editorRef.current._lineHighlight = null;
      }, 100);
    };
    editorRef.current.onDidFocusEditorWidget(() => {
      if (editorRef.current?._lineHighlight) {
        editorRef.current?.deltaDecorations(
          [editorRef.current._lineHighlight],
          []
        );
        editorRef.current._lineHighlight = null;
      }
    });

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

  useLSP(language ?? null, lspOptions ?? null);

  useEffect(() => {
    if (vim) {
      const statusNode = document.querySelector('.status-node');
      const editorMode = initVimMode(editorRef.current, statusNode);
      return () => editorMode.dispose();
    }
  }, [vim]);

  /* Note: path update handler needs to run first. Otherwise, changing both path and language
     at the same time will result in the wrong language being used */
  const previousPath = usePrevious(path);
  useUpdate(() => {
    const model = getOrCreateModel(monaco, value, language, path ?? 'default');

    if (model !== editorRef.current!.getModel()) {
      if (saveViewState)
        viewStates.set(previousPath, editorRef.current!.saveViewState());
      editorRef.current!.setModel(model);

      if (saveViewState)
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

  useEffect(() => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const clear = () => {
      editor._rainbowIndentDecorations = editor.deltaDecorations(
        editor._rainbowIndentDecorations,
        []
      );
    };

    if (!rainbowIndent) {
      clear();
      return;
    }

    ensureRainbowIndentStyles();

    const render = () => {
      const tabSize = editor.getModel()?.getOptions().tabSize ?? 4;
      editor._rainbowIndentDecorations = editor.deltaDecorations(
        editor._rainbowIndentDecorations,
        computeRainbowIndentDecorations(
          editor,
          theme === 'vs-sema' ? 'light' : 'dark',
          tabSize
        )
      );
    };

    render();

    const disposables = [
      editor.onDidScrollChange(render),
      editor.onDidChangeModelContent(render),
      editor.onDidChangeModel(render),
      editor.onDidChangeConfiguration(render),
      editor.onDidLayoutChange(render),
    ];

    return () => {
      disposables.forEach(disposable => disposable.dispose());
      clear();
    };
  }, [rainbowIndent, theme, path]);

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
    editorRef.current!.onDidChangeModelContent(() =>
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
      parameter: 'ffa657',
    },
    vs: {
      function: '795e26',
      type: '267f99',
      variable: '001080',
      constant: '0070c1',
      macro: '0000ff',
      escape: 'ee0000',
      hex: '098658',
      parameter: '953800',
    },
  };

  for (const [theme, colors] of Object.entries(COLORS)) {
    monaco.editor.defineTheme(theme + '-sema', {
      // @ts-expect-error: extending built-in themes by name is a private API
      base: theme,
      inherit: true,
      rules: [
        { token: 'function', foreground: colors.function },
        { token: 'method', foreground: colors.function },
        { token: 'operator.userDefined', foreground: colors.function },
        { token: 'class', foreground: colors.type },
        { token: 'struct', foreground: colors.type },
        { token: 'enum', foreground: colors.type },
        { token: 'type', foreground: colors.type },
        { token: 'typeParameter', foreground: colors.type },
        { token: 'namespace', foreground: colors.type },
        { token: 'variable', foreground: colors.variable },
        { token: 'parameter', foreground: colors.parameter },
        { token: 'property', foreground: colors.variable },
        { token: 'variable.readonly', foreground: colors.constant },
        { token: 'enumMember', foreground: colors.constant },
        { token: 'macro', foreground: colors.macro },
        { token: 'string.escape', foreground: colors.escape },
        { token: 'number.hex', foreground: colors.hex },
      ],
      encodedTokensColors: [],
      colors: {},
    });
  }
}
