import { TabBar } from './TabBar';
import React, { useState, useEffect } from 'react';
import { useAtomValue } from 'jotai/utils';
import JudgeResult from '../types/judge';
import { EditorProps } from './editor/MonacoEditor/monaco-editor-types';
import USACOResults from './JudgeInterface/USACOResults';
import { StatusData } from '../types/problem';
import { useUserContext } from '../context/UserContext';
import { useEditorContext } from '../context/EditorContext';
import { CodeEditor } from './editor/CodeEditor';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export interface OutputProps {
  result: JudgeResult | null;
  statusData: StatusData | null;
  statusDataHistory: StatusData[];
  onMount: EditorProps['onMount'];
}

type OutputTab = 'stdout' | 'stderr' | 'compile_output' | 'results';

const tabs = [
  { label: 'stdout', value: 'stdout' },
  { label: 'stderr', value: 'stderr' },
  { label: 'compile output', value: 'compile_output' },
  { label: 'results', value: 'results' },
];

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
  if (option !== 'results') {
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
  const { fileData } = useEditorContext();
  const { userData } = useUserContext();
  const lightMode = userData.lightMode;

  return (
    <>
      <TabBar
        tabs={statusData ? tabs : tabs.slice(0, -1)}
        activeTab={option}
        onTabSelect={tab => {
          setOption(tab.value as OutputTab);
        }}
      />
      <div className="flex-1 bg-[#1E1E1E] text-white min-h-0 overflow-hidden tw-forms-disable tw-forms-disable-all-descendants">
        {option === 'results' ? (
          <div className="px-4 h-full overflow-y-auto">
            {statusData && <USACOResults data={statusData} />}
            {statusDataHistory && (
              <table
                className={
                  'text-gray-200 table-tasks border-gray-700 space-x-2 rounded'
                }
                style={{
                  border: '1px solid #141414',
                  marginBottom: '20px',
                  marginTop: '20px',
                }}
              >
                <thead>
                  <tr>
                    <th></th>
                    <th>Verdict</th>
                    <th>Time</th>
                    <th>Memory</th>
                  </tr>
                </thead>
                <tbody>
                  {statusDataHistory
                    .slice()
                    .reverse()
                    .map((item, index) => (
                      <tr
                        style={{
                          backgroundColor: index % 2 ? '#1e1e1e' : '#121212',
                        }}
                      >
                        <td>{statusDataHistory.length - index}</td>
                        <td>
                          <a href={item.link || undefined} target="_blank">
                            {item.message?.toLowerCase() ===
                            'correct answer' ? (
                              <FontAwesomeIcon
                                icon={{ prefix: 'fas', iconName: 'check' }}
                                className="text-green-500 w-3.5 h-3.5 mr-2"
                              />
                            ) : (
                              <FontAwesomeIcon
                                icon={{ prefix: 'fas', iconName: 'xmark' }}
                                className="w-3.5 h-3.5 text-red-500 mr-2"
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
                        <td>{item.time ?? '-'}</td>
                        <td>
                          {item.memory ?? '-'}
                          {item.memory && <p>KB</p>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
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
      </div>
      {option !== 'results' && result && (
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
