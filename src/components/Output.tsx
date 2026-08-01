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
  statusDataHistory: StatusHistoryEntry[] | null;
  onReady?: SharedEditorProps['onReady'];
}

type OutputTab = 'stdout' | 'stderr' | 'compile_output' | 'results' | 'history';

function OutputHistory({
  entries,
}: {
  entries: StatusHistoryEntry[];
}): JSX.Element {
  return (
    <div className="h-full w-full overflow-y-auto">
      <table className="table-tasks w-full space-x-2 border-b border-[var(--border-color)] text-[color:var(--text-primary)]">
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
          {entries
            .slice()
            .reverse()
            .map((item, index) => (
              <tr
                style={{
                  backgroundColor:
                    index % 2 ? 'var(--panel-bg-alt)' : 'var(--panel-bg)',
                }}
                key={item.submissionTime ?? entries.length - index}
              >
                <td>{entries.length - index}</td>
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
                        className="mr-1.5 inline h-3.5 w-3.5 text-green-500"
                      />
                    ) : (
                      <FontAwesomeIcon
                        icon={{ prefix: 'fas', iconName: 'xmark' }}
                        className="mr-1.5 inline h-3.5 w-3.5 text-red-500"
                      />
                    )}
                    {item.message}
                    {item.link && (
                      <FontAwesomeIcon
                        icon={{
                          prefix: 'fas',
                          iconName: 'up-right-from-square',
                        }}
                        className="ml-1.5 inline h-3.5 w-3.5"
                      />
                    )}
                  </a>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{item.time ?? '-'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{item.memory ?? '-'}</td>
                <td>
                  <div className="flex flex-wrap">
                    {item.testCases?.map((testCase, index) => {
                      const passed = testCase.title === 'correct answer';
                      const timedOut = testCase.title === 'time limit exceeded';
                      const iconName = passed
                        ? 'check'
                        : timedOut
                          ? 'clock'
                          : testCase.title === 'runtime error'
                            ? 'bug'
                            : 'xmark';

                      return (
                        <FontAwesomeIcon
                          title={testCase.title}
                          icon={{ prefix: timedOut ? 'far' : 'fas', iconName }}
                          className={`mr-0.5 inline h-3.5 w-3.5 ${
                            passed ? 'text-green-500' : 'text-red-500'
                          }`}
                          key={index}
                        />
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export const Output = ({
  result,
  statusData,
  statusDataHistory,
  onReady,
}: OutputProps): JSX.Element => {
  const history = statusDataHistory ?? [];
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

  const availableTabs = tabs.filter(tab => {
    if (tab.value === 'results') return Boolean(statusData);
    if (tab.value === 'history') return history.length > 0;
    return true;
  });
  const currentOption = availableTabs.some(tab => tab.value === option)
    ? option
    : (availableTabs[0].value as OutputTab);

  useEffect(() => {
    if (currentOption !== option) setOption(currentOption);
  }, [currentOption, option]);

  let outputText;
  if (currentOption !== 'results' && currentOption !== 'history') {
    if (result?.status === 'internal_error') {
      outputText =
        result.debugData?.source === 'run_code'
          ? 'Run Code Error: ' + result.message
          : 'Internal Error: ' +
            result.message +
            '\n\nPlease report this as a GitHub issue.';
    } else {
      if (currentOption === 'compile_output') {
        if (result?.status === 'compile_error') {
          outputText = result.message ?? '';
        } else {
          outputText = result?.compilationMessage ?? '';
        }
      } else {
        outputText = result?.[currentOption] ?? '';
      }
    }
  }

  const { userData } = useUserContext();
  const lightMode = userData.lightMode;
  const mainMonacoEditor = useAtomValue(mainMonacoEditorAtom);

  return (
    <>
      <TabBar
        tabs={availableTabs}
        activeTab={currentOption}
        onTabSelect={tab => {
          setOption(tab.value as OutputTab);
        }}
      />
      <div className="flex-1 bg-[var(--panel-bg)] text-[color:var(--text-primary)] min-h-0 overflow-hidden tw-forms-disable tw-forms-disable-all-descendants">
        {currentOption === 'results' && (
          <div className="px-4 h-full overflow-y-auto">
            {statusData && <USACOResults data={statusData} />}
          </div>
        )}
        {currentOption === 'history' && <OutputHistory entries={history} />}
        {currentOption === 'stdout' && (
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
              fontSize: userData.fontSize,
            }}
            onReady={onReady}
          />
        )}
        {currentOption === 'stderr' && (
          <StderrOutput
            output={outputText ?? ''}
            lightMode={lightMode}
            onReady={onReady}
          />
        )}
        {currentOption === 'compile_output' && (
          <CompilerOutput
            output={outputText ?? ''}
            highlightLine={l => mainMonacoEditor?.setLineHighlight(l)}
            clearLineHighlight={() => mainMonacoEditor?.clearLineHighlight()}
          />
        )}
      </div>
      {currentOption !== 'results' && currentOption !== 'history' && result && (
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
