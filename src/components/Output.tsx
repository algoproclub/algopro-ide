import { TabBar } from './TabBar';
import React, { useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import JudgeResult from '../types/judge';
import { EditorProps } from './editor/MonacoEditor/monaco-editor-types';
import USACOResults from './JudgeInterface/USACOResults';
import { StatusData } from '../types/problem';
import { useUserContext } from '../context/UserContext';
import { CodeEditor } from './editor/CodeEditor';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CompilerOutput } from './CompilerOutput';
import { mainMonacoEditorAtom } from '../atoms/workspace';

type StatusHistoryEntry = StatusData & { submissionTime?: number };

export interface OutputProps {
  result: JudgeResult | null;
  statusData: StatusData | null;
  statusDataHistory: StatusHistoryEntry[];
  onMount: EditorProps['onMount'];
}

type OutputTab = 'stdout' | 'stderr' | 'compile_output' | 'results' | 'history';

const tabs = [
  { label: 'stdout', value: 'stdout' },
  { label: 'stderr', value: 'stderr' },
  { label: 'compile output', value: 'compile_output' },
  { label: 'results', value: 'results' },
  { label: 'history', value: 'history' },
];

const specialCppTypeSizes: Record<string, number> = {
  'std::__cxx11::basic_string': 32,
  'std::vector': 24,
};

function parseAsanError(stderr: string) {
  const asanRegex =
    /^([\s\S]*)={65}\s.+AddressSanitizer: (\S+) on address [\s\S]*?main\.cpp:(\d+)/;
  const match = stderr.match(asanRegex);

  if (match) {
    const [, originalStderr, errorType, lineNumber] = match;
    let indexError = null;
    if (errorType === 'heap-buffer-overflow') {
      const operationRegex = /\n(.+) of size (\d+)/;
      const operationMatch = stderr.match(operationRegex);
      const locationRegex =
        /is located (\d+) bytes to the (.*) of (\d+)-byte region/;
      const locationMatch = stderr.match(locationRegex);
      const declaritonRegex =
        /allocated by[\s\S]*main\.cpp:(\d+)[\s\S]*SUMMARY/;
      const declaritonMatch = stderr.match(declaritonRegex);
      if (operationMatch && locationMatch && declaritonMatch) {
        const [, operationType, typeSize] = operationMatch;
        const [, offset, direction, regionSize] = locationMatch;
        const [, lineNumber] = declaritonMatch;
        let actualTypeSize = parseInt(typeSize, 10);
        const innerTypeRegex = /std::__new_allocator<(.*?)[<>]/;
        const innerTypeMatch = stderr.match(innerTypeRegex);
        if (innerTypeMatch && innerTypeMatch[1]) {
          const innerType = innerTypeMatch[1];
          if (specialCppTypeSizes[innerType]) {
            actualTypeSize = specialCppTypeSizes[innerType];
          }
        }
        const containerSize = Math.floor(
          parseInt(regionSize, 10) / actualTypeSize
        );
        let accessedIndex: number | string = '?';
        if (direction === 'left') {
          accessedIndex = Math.floor(-parseInt(offset, 10) / actualTypeSize);
        } else if (direction === 'right') {
          accessedIndex =
            containerSize + Math.floor(parseInt(offset, 10) / actualTypeSize);
        }
        indexError = {
          operationType,
          containerSize,
          accessedIndex,
          declarationLineNumber: parseInt(lineNumber, 10),
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

export const Output = ({
  result,
  statusData,
  statusDataHistory,
  onMount,
}: OutputProps): JSX.Element => {
  const [option, setOption] = useState<OutputTab>('stdout');

  useEffect(() => {
    let option = null;
    if (
      result?.status === 'compile_error' ||
      result?.status === 'internal_error'
    )
      option = 'compile_output';
    else if (result?.stdout) option = 'stdout';
    else if (result?.stderr) option = 'stderr';
    if (option) setOption(option as OutputTab);
  }, [result?.status, result?.stdout, result?.stderr]);

  useEffect(() => {
    if (statusData) setOption('results');
  }, [statusData]);

  let outputText;
  if (option !== 'results' && option !== 'history') {
    if (result?.status === 'internal_error') {
      outputText =
        'Internal Error: ' +
        result.message +
        '\n\nPlease report this as a Github issue.';
    } else {
      if (option === 'compile_output') {
        if (result?.status === 'compile_error') {
          outputText = result.message ?? '';
        } else {
          outputText = result?.compilationMessage ?? '';
        }
      } else {
        outputText = result?.[option] ?? '';
      }
    }
  }

  const { userData } = useUserContext();
  const lightMode = userData.lightMode;
  const mainMonacoEditor = useAtomValue(mainMonacoEditorAtom);

  if (option === 'stderr' && outputText) {
    const asanError = parseAsanError(outputText);
    if (asanError) {
      const { originalStderr, errorType, lineNumber, indexError } = asanError;
      const errorLine = mainMonacoEditor
        ?.getModel()
        ?.getLineContent(lineNumber);
      outputText = `${originalStderr}${errorType} on line ${lineNumber}:\n${errorLine}\n`;
      if (indexError) {
        const {
          operationType,
          containerSize,
          accessedIndex,
          declarationLineNumber,
        } = indexError;
        const declarationLine = mainMonacoEditor
          ?.getModel()
          ?.getLineContent(declarationLineNumber);
        outputText += `Possible cause: ${operationType} on index ${accessedIndex} of size ${containerSize} container declared on line ${declarationLineNumber}:\n${declarationLine}\n`;
      }
      mainMonacoEditor?.setLineHighlight(lineNumber);
    }
  }

  return (
    <>
      <TabBar
        tabs={
          statusDataHistory
            ? tabs
            : statusData
              ? tabs.slice(0, -1)
              : tabs.slice(0, -2)
        }
        activeTab={option}
        onTabSelect={tab => {
          setOption(tab.value as OutputTab);
        }}
      />
      <div className="flex-1 bg-[#1E1E1E] text-white min-h-0 overflow-hidden tw-forms-disable tw-forms-disable-all-descendants">
        {option === 'results' && (
          <div className="px-4 h-full overflow-y-auto">
            {statusData && <USACOResults data={statusData} />}
          </div>
        )}
        {option === 'history' && (
          <div className="px-4 h-full overflow-y-auto">
            <table
              className={'text-gray-200 table-tasks space-x-2'}
              style={{
                border: '1px solid #141414',
                marginBottom: '20px',
                marginTop: '20px',
              }}
            >
              <thead style={{ backgroundColor: '#121212' }}>
                <tr>
                  <th></th>
                  <th>Verdict</th>
                  <th>Time</th>
                  <th>Memory</th>
                  <th>Testcases</th>
                </tr>
              </thead>
              <tbody>
                {statusDataHistory
                  .slice()
                  .reverse()
                  .map((item, index) => (
                    <tr
                      style={{
                        backgroundColor: index % 2 ? '#121212' : '#1e1e1e',
                      }}
                      key={
                        item.submissionTime ?? statusDataHistory.length - index
                      }
                    >
                      <td>{statusDataHistory.length - index}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <a
                          href={item.link || undefined}
                          target="_blank"
                          className={item.link ? 'hover:underline' : undefined}
                          rel="noreferrer"
                        >
                          {item.message?.toLowerCase() === 'correct answer' ? (
                            <FontAwesomeIcon
                              icon={{ prefix: 'fas', iconName: 'check' }}
                              className="text-green-500 w-3.5 h-3.5 mr-1"
                            />
                          ) : (
                            <FontAwesomeIcon
                              icon={{ prefix: 'fas', iconName: 'xmark' }}
                              className="w-3.5 h-3.5 text-red-500 mr-1"
                            />
                          )}
                          {item.message}
                          {item.link && (
                            <FontAwesomeIcon
                              icon={{
                                prefix: 'fas',
                                iconName: 'up-right-from-square',
                              }}
                              className="w-3.5 h-3.5 ml-1"
                            />
                          )}
                        </a>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {item.time ?? '-'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {item.memory ?? '-'}
                      </td>
                      <td>
                        {item.testCases &&
                          item.testCases.map((tc, index) =>
                            tc.title == 'correct answer' ? (
                              <FontAwesomeIcon
                                title={tc.title}
                                icon={{ prefix: 'fas', iconName: 'check' }}
                                className="text-green-500 w-3.5 h-3.5 mr-0.5"
                                key={index}
                              />
                            ) : (
                              <FontAwesomeIcon
                                title={tc.title}
                                icon={{
                                  prefix: (() => {
                                    if (tc.title === 'time limit exceeded')
                                      return 'far';
                                    return 'fas';
                                  })(),

                                  iconName: (() => {
                                    if (tc.title === 'time limit exceeded')
                                      return 'clock';
                                    if (tc.title === 'runtime error')
                                      return 'bug';
                                    return 'xmark';
                                  })(),
                                }}
                                className="mr-0.5 w-3.5 h-3.5 text-red-500"
                                key={index}
                              />
                            )
                          )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {(option === 'stdout' || option === 'stderr') && (
          <CodeEditor
            theme={lightMode ? 'light' : 'dark'}
            language={'plaintext'}
            value={outputText}
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
        )}
        {option === 'compile_output' && (
          <CompilerOutput
            output={outputText ?? ''}
            highlightLine={l => mainMonacoEditor?.setLineHighlight(l)}
            clearLineHighlight={() => mainMonacoEditor?.clearLineHighlight()}
          />
        )}
      </div>
      {option !== 'results' && option !== 'history' && result && (
        <div
          className="text-sm font-mono text-right px-4 py-1 text-gray-300"
          data-test-id="code-execution-output-status"
        >
          {result.statusDescription}, {result.time ?? '-'}s,{' '}
          {result.memory ?? '-'}KB
        </div>
      )}
    </>
  );
};
