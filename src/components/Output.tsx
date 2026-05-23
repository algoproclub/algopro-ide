import { TabBar } from './TabBar';
import React, { useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import JudgeResult from '../types/judge';
import type { SharedEditorProps } from './editor/editor-types';
import USACOResults from './JudgeInterface/USACOResults';
import { StatusData } from '../types/problem';
import { useUserContext } from '../context/UserContext';
import { CodeEditor } from './editor/CodeEditor';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CompilerOutput } from './CompilerOutput';
import { mainMonacoEditorAtom } from '../atoms/workspace';
import { StderrOutput } from './StderrOutput';

type StatusHistoryEntry = StatusData & { submissionTime?: number };

export interface OutputProps {
  result: JudgeResult | null;
  statusData: StatusData | null;
  statusDataHistory: StatusHistoryEntry[];
  onReady?: SharedEditorProps['onReady'];
}

type OutputTab = 'stdout' | 'stderr' | 'compile_output' | 'results' | 'history';

export const Output = ({
  result,
  statusData,
  statusDataHistory,
  onReady,
}: OutputProps): JSX.Element => {
  const [option, setOption] = useState<OutputTab>('stdout');
  const [tabs, setTabs] = useState<
    Array<{ label: string; value: string; highlight: boolean }>
  >([
    { label: 'stdout', value: 'stdout', highlight: false },
    { label: 'stderr', value: 'stderr', highlight: false },
    { label: 'compile output', value: 'compile_output', highlight: false },
    { label: 'results', value: 'results', highlight: false },
    { label: 'history', value: 'history', highlight: false },
  ]);

  useEffect(() => {
    setOption('stdout');
    let option = null;
    const updatedTabs = tabs.map(tab => ({ ...tab, highlight: false }));

    if (result?.stderr) {
      option = 'stderr';
      const stderrTab = updatedTabs.find(tab => tab.value === 'stderr');
      if (stderrTab) stderrTab.highlight = true;
    }
    if (result?.stdout) {
      option = 'stdout';
      const stdoutTab = updatedTabs.find(tab => tab.value === 'stdout');
      if (stdoutTab) stdoutTab.highlight = true;
    }
    if (result?.compilationMessage) {
      const compileTab = updatedTabs.find(
        tab => tab.value === 'compile_output'
      );
      if (compileTab) compileTab.highlight = true;
    }
    if (
      result?.status === 'compile_error' ||
      result?.status === 'internal_error'
    ) {
      option = 'compile_output';
    }

    setTabs(updatedTabs);
    if (option) setOption(option as OutputTab);
  }, [result?.status, result?.stdout, result?.stderr]);

  useEffect(() => {
    if (statusData) setOption('results');
  }, [statusData]);

  let outputText;
  if (option !== 'results' && option !== 'history') {
    if (result?.status === 'internal_error') {
      outputText =
        result.debugData?.source === 'run_code'
          ? 'Run Code Error: ' + result.message
          : 'Internal Error: ' +
            result.message +
            '\n\nPlease report this as a GitHub issue.';
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
      <div className="flex-1 bg-[var(--panel-bg)] text-[color:var(--text-primary)] min-h-0 overflow-hidden tw-forms-disable tw-forms-disable-all-descendants">
        {option === 'results' && (
          <div className="px-4 h-full overflow-y-auto">
            {statusData && <USACOResults data={statusData} />}
          </div>
        )}
        {option === 'history' && (
          <div className="h-full overflow-y-auto w-full">
            <table
              className={
                'text-[color:var(--text-primary)] table-tasks space-x-2 w-full border-b border-[var(--border-color)]'
              }
            >
              <thead
                className="border-b border-[var(--border-color)] text-left text-sm"
                style={{ backgroundColor: 'var(--panel-bg-alt)' }}
              >
                <tr>
                  <th></th>
                  <th>Verdict</th>
                  <th>Time</th>
                  <th>Memory</th>
                  <th>Testcases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] text-sm">
                {statusDataHistory
                  .slice()
                  .reverse()
                  .map((item, index) => (
                    <tr
                      style={{
                        backgroundColor:
                          index % 2 ? 'var(--panel-bg-alt)' : 'var(--panel-bg)',
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
                          className={`${item.link ? 'hover:underline' : undefined} flex items-center`}
                          rel="noreferrer"
                        >
                          {item.message?.toLowerCase() === 'correct answer' ? (
                            <FontAwesomeIcon
                              icon={{ prefix: 'fas', iconName: 'check' }}
                              className="text-green-500 w-3.5 h-3.5 mr-1.5 inline"
                            />
                          ) : (
                            <FontAwesomeIcon
                              icon={{ prefix: 'fas', iconName: 'xmark' }}
                              className="w-3.5 h-3.5 text-red-500 mr-1.5 inline"
                            />
                          )}
                          {item.message}
                          {item.link && (
                            <FontAwesomeIcon
                              icon={{
                                prefix: 'fas',
                                iconName: 'up-right-from-square',
                              }}
                              className="w-3.5 h-3.5 ml-1.5 inline"
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
                        <div className="flex flex-wrap">
                          {item.testCases &&
                            item.testCases.map((tc, index) =>
                              tc.title == 'correct answer' ? (
                                <FontAwesomeIcon
                                  title={tc.title}
                                  icon={{ prefix: 'fas', iconName: 'check' }}
                                  className="text-green-500 w-3.5 h-3.5 mr-0.5 inline"
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
                                  className="mr-0.5 w-3.5 h-3.5 text-red-500 inline"
                                  key={index}
                                />
                              )
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {option === 'stdout' && (
          <CodeEditor
            theme={lightMode ? 'light' : 'dark'}
            language={'plaintext'}
            value={outputText}
            saveViewState={false}
            path="output"
            editorOptions={{
              readOnly: true,
              automaticLayout: false,
              insertSpaces: true,
            }}
            onReady={onReady}
          />
        )}
        {option === 'stderr' && (
          <StderrOutput
            output={outputText ?? ''}
            lightMode={lightMode}
            onReady={onReady}
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
          className="text-sm font-mono text-right px-4 py-1 text-[color:var(--text-secondary)]"
          data-test-id="code-execution-output-status"
        >
          {result.statusDescription}, {result.time ?? '-'}s,{' '}
          {result.memory ?? '-'}KB
        </div>
      )}
    </>
  );
};
