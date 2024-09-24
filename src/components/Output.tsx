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

type OutputTab = 'stdout' | 'stderr' | 'compile_output' | 'results' | 'history';

const tabs = [
  { label: 'stdout', value: 'stdout' },
  { label: 'stderr', value: 'stderr' },
  { label: 'compile output', value: 'compile_output' },
  { label: 'results', value: 'results' },
  { label: 'history', value: 'history' },
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
  const { fileData } = useEditorContext();
  const { userData } = useUserContext();
  const lightMode = userData.lightMode;

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
              className={'text-gray-200 table-tasks space-x-2 mr-5 w-full'}
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
                    >
                      <td>{statusDataHistory.length - index}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <a
                          href={item.link || undefined}
                          target="_blank"
                          className={'hover:underline'}
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
                          item.testCases.map(tc =>
                            tc.title == 'correct answer' ? (
                              <FontAwesomeIcon
                                title={tc.title}
                                icon={{ prefix: 'fas', iconName: 'check' }}
                                className="text-green-500 w-3.5 h-3.5 mr-0.5"
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
        {option !== 'results' && option != 'history' && (
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
