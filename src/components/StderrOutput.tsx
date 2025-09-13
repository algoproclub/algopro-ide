import React from 'react';
import {
  mainMonacoEditorAtom,
  isLineHighlightSetAtom,
  savedEditorValue as savedEditorValueAtom,
} from '../atoms/workspace';
import { useAtomValue, useSetAtom } from 'jotai';
import { OnMount } from './editor/MonacoEditor/monaco-editor-types';
import { CodeEditor } from './editor/CodeEditor';
import { editor } from 'monaco-editor';

const ASAN_REGEX =
  /^([\s\S]*)={65}\s.+AddressSanitizer: (\S+) on address [\s\S]*?main\.cpp:(\d+)/;
const ASAN_OPERATION_REGEX = /\n(.+) of size (\d+)/;
const ASAN_LOCATION_REGEX = /is located (\d+) bytes (.*) (\d+)-byte region/;
const LEFT_DIRECTION = 'before';
const RIGHT_DIRECTION = 'after';
const ASAN_DECLARATION_REGEX =
  /allocated by[\s\S]*main\.cpp:(\d+)[\s\S]*SUMMARY/;
const ASAN_POINTER_REGEX = /\*>::allocate/;
const ASAN_INNER_TYPE_REGEX = /std::__new_allocator<(.*?)[<>]/;
const UBSAN_REGEX = /^([\s\S]*)main\.cpp:(\d*):/;

const basicCppTypes = [
  'int',
  'long',
  'long long',
  'short',
  'char',
  'unsigned int',
  'unsigned long',
  'unsigned long long',
  'unsigned short',
  'unsigned char',
  'float',
  'double',
  'long double',
];

const specialCppTypeSizes: Record<string, number> = {
  'std::__cxx11::basic_string': 32,
  'std::vector': 24,
};

function parseAsanError(stderr: string) {
  const match = stderr.match(ASAN_REGEX);

  if (match) {
    const [, originalStderr, errorType, lineNumber] = match;
    let indexError = null;
    if (errorType === 'heap-buffer-overflow') {
      const operationMatch = stderr.match(ASAN_OPERATION_REGEX);
      const locationMatch = stderr.match(ASAN_LOCATION_REGEX);
      const declaritonMatch = stderr.match(ASAN_DECLARATION_REGEX);
      if (operationMatch && locationMatch && declaritonMatch) {
        const [, operationType, typeSize] = operationMatch;
        const [, offset, direction, regionSize] = locationMatch;
        const [, declarationLineNumber] = declaritonMatch;
        let actualTypeSize: number | null = null;
        const pointerMatch = stderr.match(ASAN_POINTER_REGEX);
        if (pointerMatch) {
          actualTypeSize = 8;
        } else {
          const innerTypeMatch = stderr.match(ASAN_INNER_TYPE_REGEX);
          if (innerTypeMatch && innerTypeMatch[1]) {
            const innerType = innerTypeMatch[1];
            if (specialCppTypeSizes[innerType]) {
              actualTypeSize = specialCppTypeSizes[innerType];
            }
            if (basicCppTypes.includes(innerType)) {
              actualTypeSize = parseInt(typeSize, 10);
            }
          }
        }
        let containerSize: number | string = '?';
        let accessedIndex: number | string = '?';
        if (actualTypeSize) {
          containerSize = Math.floor(parseInt(regionSize, 10) / actualTypeSize);
          if (direction === LEFT_DIRECTION) {
            accessedIndex = Math.floor(-parseInt(offset, 10) / actualTypeSize);
          } else if (direction === RIGHT_DIRECTION) {
            accessedIndex =
              containerSize + Math.floor(parseInt(offset, 10) / actualTypeSize);
          }
        }
        indexError = {
          operationType,
          containerSize,
          accessedIndex,
          declarationLineNumber: parseInt(declarationLineNumber, 10),
        };
      }
    }
    return {
      originalStderr,
      errorType,
      lineNumber: parseInt(lineNumber, 10),
      indexError,
    };
  }

  return null;
}

function parseUBsanError(stderr: string) {
  const match = stderr.match(UBSAN_REGEX);
  if (match) {
    const [, originalStderr, lineNumber] = match;
    return {
      originalStderr,
      lineNumber: parseInt(lineNumber, 10),
    };
  }
  return null;
}

function validateLine(
  lineNumber: number,
  lineContent: string,
  model: editor.ITextModel | null | undefined
): boolean {
  if (model && lineNumber <= model.getLineCount()) {
    return model.getLineContent(lineNumber) === lineContent;
  }
  return false;
}

export const StderrOutput = ({
  output,
  lightMode,
  onMount,
}: {
  output: string;
  lightMode: boolean;
  onMount: OnMount | undefined;
}): JSX.Element => {
  const mainMonacoEditor = useAtomValue(mainMonacoEditorAtom);
  const isLineHighlightSet = useAtomValue(isLineHighlightSetAtom);
  const savedEditorValue = useAtomValue(savedEditorValueAtom);
  const setIsLineHighlightSet = useSetAtom(isLineHighlightSetAtom);

  let decodedOutput = output;
  const editorValueLines = savedEditorValue
    ? savedEditorValue.split('\n')
    : null;
  const getLineContent = (lineNumber: number) => {
    return editorValueLines == null || editorValueLines.length < lineNumber
      ? '\t<not available, run the code again to see>'
      : editorValueLines[lineNumber - 1];
  };
  const asanError = parseAsanError(output);
  let errorLineNumber: number | undefined = undefined;
  let errorLineContent: string = '';

  if (asanError) {
    const { originalStderr, errorType, lineNumber, indexError } = asanError;
    errorLineNumber = lineNumber;
    errorLineContent = getLineContent(lineNumber);
    decodedOutput = `${originalStderr}${errorType} on line ${lineNumber}:\n${errorLineContent}\n`;

    if (indexError) {
      const {
        operationType,
        containerSize,
        accessedIndex,
        declarationLineNumber,
      } = indexError;
      const declarationLine = getLineContent(declarationLineNumber);
      decodedOutput += `Possible cause: ${operationType} on index ${accessedIndex} of size ${containerSize} container created on line ${declarationLineNumber}:\n${declarationLine}\n`;
    }
  }

  const ubsanError = parseUBsanError(output);
  if (!asanError && ubsanError) {
    const lineNumber = ubsanError['lineNumber'];
    errorLineNumber = lineNumber;
    const errorLine = getLineContent(lineNumber);
    decodedOutput += errorLine;
  }

  if (!isLineHighlightSet && errorLineNumber) {
    mainMonacoEditor?.setLineHighlight(errorLineNumber);
    setIsLineHighlightSet(true);
  }

  return (
    <div
      style={{
        height: '100%',
      }}
      onMouseOver={() =>
        errorLineNumber &&
        validateLine(
          errorLineNumber,
          errorLineContent,
          mainMonacoEditor?.getModel()
        ) &&
        mainMonacoEditor?.setLineHighlight(errorLineNumber)
      }
      onMouseLeave={() =>
        errorLineNumber && mainMonacoEditor?.clearLineHighlight()
      }
    >
      <CodeEditor
        theme={lightMode ? 'light' : 'dark'}
        language={'plaintext'}
        value={decodedOutput}
        saveViewState={false}
        path="output"
        options={{
          minimap: { enabled: false },
          readOnly: true,
          automaticLayout: false,
          insertSpaces: true,
        }}
        onMount={onMount}
      />
    </div>
  );
};
