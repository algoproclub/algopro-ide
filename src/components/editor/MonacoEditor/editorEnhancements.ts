import * as monaco from 'monaco-editor';
import { AlgoProMonacoEditor, BugHighlightMark } from '../editor-types';

type ThemeMode = 'dark' | 'light';

type EditorEnhancements = {
  editor: AlgoProMonacoEditor;
  updateRainbowIndent: (enabled: boolean, themeMode: ThemeMode) => void;
  dispose: () => void;
};

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

function ensureRainbowIndentStyles() {
  if (document.getElementById(RAINBOW_INDENT_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = RAINBOW_INDENT_STYLE_ID;
  style.textContent = ['dark', 'light']
    .flatMap(mode =>
      RAINBOW_INDENT_COLORS[mode as ThemeMode].map(
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
  themeMode: ThemeMode,
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

export function createEditorEnhancements(
  editor: monaco.editor.IStandaloneCodeEditor
): EditorEnhancements {
  const lineHighlightDecorations = editor.createDecorationsCollection();
  const bugHighlightDecorations = editor.createDecorationsCollection();
  let lineHighlightTimeout: ReturnType<typeof setTimeout> | null = null;
  const rainbowIndentDecorations = editor.createDecorationsCollection();
  let rainbowIndentDisposables: monaco.IDisposable[] = [];
  let rainbowIndentThemeMode: ThemeMode = 'dark';
  let hasLineHighlight = false;

  const clearLineHighlightImmediately = () => {
    if (!hasLineHighlight) {
      return;
    }

    lineHighlightDecorations.clear();
    hasLineHighlight = false;
  };

  const clearRainbowIndent = () => {
    rainbowIndentDecorations.clear();
  };

  const renderRainbowIndent = () => {
    const tabSize = editor.getModel()?.getOptions().tabSize ?? 4;
    rainbowIndentDecorations.set(
      computeRainbowIndentDecorations(editor, rainbowIndentThemeMode, tabSize)
    );
  };

  const disposeRainbowIndent = () => {
    rainbowIndentDisposables.forEach(disposable => disposable.dispose());
    rainbowIndentDisposables = [];
    clearRainbowIndent();
  };

  const enhancedEditor = editor as AlgoProMonacoEditor;
  enhancedEditor.setLineHighlight = (line: number) => {
    const model = editor.getModel();
    if (!model || line < 1 || line > model.getLineCount()) {
      return;
    }

    if (lineHighlightTimeout) {
      clearTimeout(lineHighlightTimeout);
      lineHighlightTimeout = null;
    }

    lineHighlightDecorations.set([
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'linked-line-highlight',
        },
      },
    ]);
    hasLineHighlight = true;
  };

  enhancedEditor.clearLineHighlight = () => {
    if (!hasLineHighlight) {
      return;
    }

    if (lineHighlightTimeout) {
      clearTimeout(lineHighlightTimeout);
    }

    lineHighlightTimeout = setTimeout(() => {
      clearLineHighlightImmediately();
      lineHighlightTimeout = null;
    }, 100);
  };

  // AI Debug feature: a persistent set of "suspected bug" line highlights.
  // Kept separate from the transient single-line linked highlight above so the
  // two never clobber each other. Cleared on a new debug run, on Run Code, and
  // on dispose.
  enhancedEditor.setBugHighlights = (marks: BugHighlightMark[]) => {
    const model = editor.getModel();
    if (!model) {
      return;
    }

    const lineCount = model.getLineCount();
    const decorations: monaco.editor.IModelDeltaDecoration[] = marks
      .filter(mark => mark.line >= 1 && mark.line <= lineCount)
      .map(mark => ({
        // Span the whole line so the hover tooltip (the reason) triggers when
        // hovering anywhere on the line, not only column 1. isWholeLine still
        // drives the red background; glyphMarginHoverMessage covers the red dot.
        range: new monaco.Range(
          mark.line,
          1,
          mark.line,
          model.getLineMaxColumn(mark.line)
        ),
        options: {
          isWholeLine: true,
          className: 'debug-bug-highlight',
          glyphMarginClassName: 'debug-bug-glyph',
          overviewRuler: {
            color: 'rgba(248, 87, 87, 0.7)',
            position: monaco.editor.OverviewRulerLane.Right,
          },
          ...(mark.hoverMessage
            ? {
                hoverMessage: { value: mark.hoverMessage },
                glyphMarginHoverMessage: { value: mark.hoverMessage },
              }
            : {}),
        },
      }));

    bugHighlightDecorations.set(decorations);
  };

  enhancedEditor.clearBugHighlights = () => {
    bugHighlightDecorations.clear();
  };

  const focusDisposable = editor.onDidFocusEditorWidget(() => {
    if (lineHighlightTimeout) {
      clearTimeout(lineHighlightTimeout);
      lineHighlightTimeout = null;
    }

    clearLineHighlightImmediately();
  });

  return {
    editor: enhancedEditor,
    updateRainbowIndent(enabled: boolean, themeMode: ThemeMode) {
      rainbowIndentThemeMode = themeMode;

      if (!enabled) {
        disposeRainbowIndent();
        return;
      }

      ensureRainbowIndentStyles();

      if (!rainbowIndentDisposables.length) {
        rainbowIndentDisposables = [
          editor.onDidScrollChange(renderRainbowIndent),
          editor.onDidChangeModelContent(renderRainbowIndent),
          editor.onDidChangeModel(renderRainbowIndent),
          editor.onDidChangeConfiguration(renderRainbowIndent),
          editor.onDidLayoutChange(renderRainbowIndent),
        ];
      }

      renderRainbowIndent();
    },
    dispose() {
      focusDisposable.dispose();

      if (lineHighlightTimeout) {
        clearTimeout(lineHighlightTimeout);
        lineHighlightTimeout = null;
      }

      clearLineHighlightImmediately();
      disposeRainbowIndent();
      lineHighlightDecorations.clear();
      bugHighlightDecorations.clear();
      rainbowIndentDecorations.clear();
    },
  };
}
