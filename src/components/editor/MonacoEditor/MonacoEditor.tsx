import { useEffect, useRef, useState } from 'react';

import * as monaco from 'monaco-editor';
import {
  EditorApp,
  type EditorAppConfig,
} from 'monaco-languageclient/editorApp';
import { initVimMode } from 'monaco-vim';
import { usePrevious, useUpdate } from './utils';
import {
  AlgoProMonacoEditor,
  EditorProps,
  MonacoEditorHandle,
} from '../editor-types';
import useLSP from './lsp';
import { MonacoBinding } from 'y-monaco';
import { createEditorEnhancements } from './editorEnhancements';
import {
  ensureMonacoServices,
  MONACO_VSCODE_DARK_THEME,
  MONACO_VSCODE_LIGHT_THEME,
  MONACO_WORKSPACE_URI,
} from './monacoServices';

const viewStates = new Map<string, monaco.editor.ICodeEditorViewState | null>();

// @ts-expect-error todo find a better way to do this
window.monaco = monaco;

const EDITOR_TEXT_FOCUS = 'editorTextFocus';
const INSERT_LINE_AFTER_DEFAULT_BINDING =
  monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter;
const INSERT_LINE_AFTER_REBOUND_BINDING =
  monaco.KeyMod.Alt | monaco.KeyCode.Enter;

const LANGUAGE_EXTENSION_LOADERS: Record<string, () => Promise<unknown>> = {
  cpp: () => import('@codingame/monaco-vscode-cpp-default-extension'),
  java: () => import('@codingame/monaco-vscode-java-default-extension'),
  python: () => import('@codingame/monaco-vscode-python-default-extension'),
  html: () => import('@codingame/monaco-vscode-html-default-extension'),
};

const languageExtensionLoadPromises = new Map<string, Promise<void>>();

function loadLanguageExtension(language?: string | null): Promise<void> {
  const normalizedLanguage = language?.toLowerCase();

  if (!normalizedLanguage) {
    return Promise.resolve();
  }

  const loader = LANGUAGE_EXTENSION_LOADERS[normalizedLanguage];

  if (!loader) {
    return Promise.resolve();
  }

  const cachedPromise = languageExtensionLoadPromises.get(normalizedLanguage);
  if (cachedPromise) {
    return cachedPromise;
  }

  const loadPromise = loader()
    .then(() => undefined)
    .catch(error => {
      // Allow retry if a dynamic import fails.
      languageExtensionLoadPromises.delete(normalizedLanguage);
      throw error;
    });

  languageExtensionLoadPromises.set(normalizedLanguage, loadPromise);

  return loadPromise;
}

const rebindAction = (
  id: string,
  oldBinding: number | undefined,
  newBinding?: number
) => {
  const rules: monaco.editor.IKeybindingRule[] = [];

  if (oldBinding !== undefined) {
    rules.push({
      command: null,
      keybinding: oldBinding,
    });
  }

  if (newBinding !== undefined) {
    rules.push({
      command: id,
      keybinding: newBinding,
      when: EDITOR_TEXT_FOCUS,
    });
  }

  return monaco.editor.addKeybindingRules(rules);
};

function toModelPath(path?: string) {
  if (!path) {
    return `${MONACO_WORKSPACE_URI.toString()}/default`;
  }

  if (/^[a-zA-Z][\w+.-]*:/.test(path)) {
    return path;
  }

  return `${MONACO_WORKSPACE_URI.toString()}/${path.replace(/^\/+/, '')}`;
}

function createEditorAppConfig(
  props: Pick<
    EditorProps,
    'editorOptions' | 'language' | 'monacoOptions' | 'path' | 'value'
  > & {
    resolvedTheme: string;
  }
): EditorAppConfig {
  return {
    codeResources: {
      modified: {
        text: props.value ?? '',
        uri: toModelPath(props.path),
        enforceLanguageId: props.language ?? 'plaintext',
      },
    },
    editorOptions: {
      insertSpaces: props.editorOptions?.insertSpaces,
      readOnly: props.editorOptions?.readOnly,
      lightbulb: {
        enabled: monaco.editor.ShowLightbulbIconMode.On,
      },
      inlayHints: {
        enabled: 'off',
      },
      minimap: { enabled: false },
      bracketPairColorization: {
        enabled: true,
      },
      links: false,
      'semanticHighlighting.enabled': true,
      tabSize: props.editorOptions?.tabSize,
      theme: props.resolvedTheme,
      ...props.monacoOptions,
    },
    overrideAutomaticLayout: props.editorOptions?.automaticLayout ?? true,
  };
}

function createEditorHandle(editor: AlgoProMonacoEditor): MonacoEditorHandle {
  return {
    clearLineHighlight() {
      editor.clearLineHighlight();
    },
    focus() {
      editor.focus();
    },
    getValue() {
      return editor.getValue();
    },
    kind: 'monaco',
    layout() {
      editor.layout();
    },
    raw: editor,
    setLineHighlight(line: number) {
      editor.setLineHighlight(line);
    },
  };
}

export default function MonacoEditor({
  path,
  theme,
  editorOptions,
  monacoOptions,
  saveViewState = true,
  onReady,
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
  const editorAppRef = useRef<EditorApp | null>(null);
  const editorRef = useRef<AlgoProMonacoEditor | null>(null);
  const enhancementsRef = useRef<ReturnType<
    typeof createEditorEnhancements
  > | null>(null);
  const [editor, setEditor] = useState<AlgoProMonacoEditor | null>(null);
  const latestPropsRef = useRef({
    editorOptions,
    language,
    monacoOptions,
    onBeforeDispose,
    onReady,
    path,
    resolvedTheme: MONACO_VSCODE_DARK_THEME as string,
    saveViewState,
    value,
  });
  const latestYjsInfoRef = useRef(yjsInfo);

  const resolvedTheme =
    theme === 'light'
      ? MONACO_VSCODE_LIGHT_THEME
      : theme === 'dark' || theme == null
        ? MONACO_VSCODE_DARK_THEME
        : theme;

  latestPropsRef.current = {
    editorOptions,
    language,
    monacoOptions,
    onBeforeDispose,
    onReady,
    path,
    resolvedTheme,
    saveViewState,
    value,
  };
  latestYjsInfoRef.current = yjsInfo;

  useEffect(() => {
    let disposed = false;
    let keybindingDisposable: monaco.IDisposable | undefined;
    let createdEditorApp: EditorApp | null = null;

    void Promise.all([
      ensureMonacoServices(),
      loadLanguageExtension(latestPropsRef.current.language),
    ])
      .then(async () => {
        if (disposed || !ref.current) {
          return;
        }

        const {
          editorOptions: initialEditorOptions,
          language: initialLanguage,
          monacoOptions: initialMonacoOptions,
          onReady: initialOnReady,
          path: initialPath,
          resolvedTheme: initialResolvedTheme,
          saveViewState: initialSaveViewState,
          value: initialValue,
        } = latestPropsRef.current;

        const editorApp = new EditorApp(
          createEditorAppConfig({
            editorOptions: initialEditorOptions,
            language: initialLanguage,
            monacoOptions: initialMonacoOptions,
            path: initialPath,
            resolvedTheme: initialResolvedTheme,
            value: initialValue,
          })
        );
        createdEditorApp = editorApp;
        editorAppRef.current = editorApp;

        await editorApp.start(ref.current);

        const editorInstance = editorApp.getEditor();

        if (!editorInstance) {
          throw new Error('EditorApp did not create a Monaco editor instance');
        }

        const enhancements = createEditorEnhancements(editorInstance);

        if (disposed) {
          enhancements.dispose();
          await editorApp.dispose();
          return;
        }

        editorRef.current = enhancements.editor;
        enhancementsRef.current = enhancements;

        // Ctrl+Enter for "Insert Line Below" conflicts with our shortcut for running code.
        keybindingDisposable = rebindAction(
          'editor.action.insertLineAfter',
          INSERT_LINE_AFTER_DEFAULT_BINDING,
          INSERT_LINE_AFTER_REBOUND_BINDING
        );

        if (initialSaveViewState) {
          const savedViewState = viewStates.get(toModelPath(initialPath));

          if (savedViewState) {
            enhancements.editor.restoreViewState(savedViewState);
          }
        }

        setEditor(enhancements.editor);
        initialOnReady?.(createEditorHandle(enhancements.editor));
      })
      .catch(error => {
        console.error('Failed to initialize Monaco editor:', error);
      });

    return () => {
      disposed = true;
      keybindingDisposable?.dispose();
      keybindingDisposable = undefined;

      const currentEditorApp = editorAppRef.current ?? createdEditorApp;

      if (editorRef.current) {
        latestPropsRef.current.onBeforeDispose?.();
      }

      enhancementsRef.current?.dispose();
      enhancementsRef.current = null;
      editorRef.current = null;
      editorAppRef.current = null;

      if (currentEditorApp) {
        void currentEditorApp.dispose().catch(error => {
          console.error('Failed to dispose Monaco editor app:', error);
        });
      }

      setEditor(null);
    };
  }, []);

  useEffect(() => {
    if (!yjsInfo || !editor) return;

    if (yjsInfo.path !== undefined && yjsInfo.path !== path) {
      return;
    }

    const model = editor.getModel();

    if (!model) {
      return;
    }

    const monacoBinding = new MonacoBinding(
      yjsInfo.yjsText,
      model,
      new Set([editor]),
      yjsInfo.yjsAwareness
    );

    let bindingDestroyed = false;
    const markBindingDestroyed = model.onWillDispose(() => {
      bindingDestroyed = true;
      markBindingDestroyed.dispose();
    });

    return () => {
      markBindingDestroyed.dispose();

      // y-monaco destroys the binding when the model is disposed.
      // Avoid calling destroy twice during unmounts or hot reload.
      if (!bindingDestroyed) {
        bindingDestroyed = true;
        monacoBinding.destroy();
      }
    };
  }, [editor, path, yjsInfo]);

  useLSP(language ?? null, lspOptions ?? null, editor !== null);

  useEffect(() => {
    if (!vim || !editor) {
      return;
    }

    const statusNode = document.querySelector('.status-node');
    const editorMode = initVimMode(editor, statusNode);
    return () => editorMode.dispose();
  }, [editor, vim]);

  /* Note: path update handler needs to run first. Otherwise, changing both path and language
     at the same time will result in the wrong language being used */
  const previousPath = usePrevious(path);
  useUpdate(() => {
    if (!editor || !editorRef.current || !editorAppRef.current) {
      return;
    }

    void (async () => {
      const currentEditor = editorRef.current;
      const editorApp = editorAppRef.current;
      const {
        language: currentLanguage,
        saveViewState: shouldSaveViewState,
        value: currentValue,
      } = latestPropsRef.current;
      const currentYjsInfo = latestYjsInfoRef.current;

      if (!currentEditor || !editorApp) {
        return;
      }

      const modelPath = toModelPath(path);
      const previousModelPath = toModelPath(previousPath);

      if (shouldSaveViewState) {
        viewStates.set(previousModelPath, currentEditor.saveViewState());
      }

      const collaborativeText =
        currentYjsInfo &&
        (currentYjsInfo.path === undefined || currentYjsInfo.path === path)
          ? currentYjsInfo.yjsText.toString()
          : null;

      const updated = await editorApp.updateCodeResources({
        modified: {
          text: collaborativeText ?? currentValue,
          uri: modelPath,
          enforceLanguageId: currentLanguage ?? 'plaintext',
        },
      });

      if (!updated || !shouldSaveViewState) {
        return;
      }

      const savedViewState = viewStates.get(modelPath);

      if (savedViewState) {
        currentEditor.restoreViewState(savedViewState);
      }
    })().catch(error => {
      console.error('Failed to update Monaco code resources:', error);
    });
  }, [editor, path, previousPath]);

  useUpdate(() => {
    if (!editor || !editorRef.current) {
      return;
    }

    if (yjsInfo && (yjsInfo.path === undefined || yjsInfo.path === path)) {
      return;
    }

    if (editorRef.current.getOption(monaco.editor.EditorOption.readOnly)) {
      editorRef.current.setValue(value);
    } else {
      if (value !== editorRef.current.getValue()) {
        editorRef.current.executeEdits('', [
          {
            range: editorRef.current.getModel()!.getFullModelRange(),
            text: value,
            forceMoveMarkers: true,
          },
        ]);

        editorRef.current.pushUndoStop();
      }
    }
  }, [editor, path, value, yjsInfo]);

  useUpdate(() => {
    if (!editor) {
      return;
    }

    // theme is global
    monaco.editor.setTheme(resolvedTheme ?? MONACO_VSCODE_DARK_THEME);
  }, [editor, resolvedTheme]);

  useEffect(() => {
    if (!enhancementsRef.current) {
      return;
    }

    enhancementsRef.current.updateRainbowIndent(
      rainbowIndent,
      resolvedTheme === MONACO_VSCODE_LIGHT_THEME ? 'light' : 'dark'
    );
  }, [editor, path, rainbowIndent, resolvedTheme]);

  useUpdate(() => {
    if (!editor || !editorRef.current) {
      return;
    }

    const targetLanguage = language ?? 'plaintext';
    let cancelled = false;

    void (async () => {
      try {
        await loadLanguageExtension(targetLanguage);
      } catch (error) {
        console.error('Failed to load Monaco language extension:', error);
        return;
      }

      if (cancelled) {
        return;
      }

      const model = editorRef.current?.getModel();

      if (!model) {
        return;
      }

      monaco.editor.setModelLanguage(model, targetLanguage);
    })();

    return () => {
      cancelled = true;
    };
  }, [editor, language]);

  useUpdate(() => {
    if (!editor || !editorRef.current) {
      return;
    }

    editorRef.current.updateOptions({
      automaticLayout: editorOptions?.automaticLayout,
      insertSpaces: editorOptions?.insertSpaces,
      readOnly: editorOptions?.readOnly,
      tabSize: editorOptions?.tabSize,
      ...monacoOptions,
    });
  }, [editor, editorOptions, monacoOptions]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const disposable = editor.onDidChangeModelContent(() =>
      onChange?.(editor.getValue())
    );

    return () => disposable.dispose();
  }, [editor, onChange]);

  return (
    <div className="flex relative h-full">
      <div className={className} ref={ref} style={{ width: '100%' }}></div>
    </div>
  );
}
