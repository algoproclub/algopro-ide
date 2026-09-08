import { TabBar } from './TabBar';
import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import JudgeResult from '../types/judge';
import USACOResults from './JudgeInterface/USACOResults';
import { StatusData } from '../types/problem';
import { useUserContext } from '../context/UserContext';
import { CodeEditor } from './editor/CodeEditor';
import { CompilerOutput } from './CompilerOutput';
import { mainMonacoEditorAtom } from '../atoms/workspace';
import { StderrOutput } from './StderrOutput';
import { getJudgeStatusDescription } from '../utils/editorUtils';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/16/solid';
import {
  getSubmissionStatusDisplay,
  getTestCaseStatusDisplay,
} from './TaskStatus/statusDisplay';

type StatusHistoryEntry = StatusData & { submissionTime?: number };

export interface OutputProps {
  result: JudgeResult | null;
  statusData: StatusData | null;
  statusDataHistory: StatusHistoryEntry[] | null;
}

type OutputTab = 'stdout' | 'stderr' | 'compile_output' | 'results' | 'history';

type OutputSelection = {
  result: JudgeResult | null;
  statusData: StatusData | null;
  selectedId: OutputTab;
  acknowledged: OutputTab[];
};
function isSameOutput(
  previous: JudgeResult | null,
  current: JudgeResult | null
): boolean {
  return (
    previous?.status === current?.status &&
    previous?.stdout === current?.stdout &&
    previous?.stderr === current?.stderr &&
    previous?.message === current?.message &&
    previous?.compilationMessage === current?.compilationMessage &&
    previous?.signal === current?.signal &&
    previous?.debugData?.source === current?.debugData?.source
  );
}

function getDefaultOutputTab(result: JudgeResult | null): OutputTab {
  if (
    result?.status === 'compile_error' ||
    result?.status === 'internal_error'
  ) {
    return 'compile_output';
  }
  if (result?.stdout) return 'stdout';
  if (result?.stderr) return 'stderr';
  return 'stdout';
}

function getOutputText(result: JudgeResult | null, tab: OutputTab): string {
  if (result?.status === 'internal_error') {
    return result.debugData?.source === 'run_code'
      ? `Run Code Error: ${result.message}`
      : `Internal Error: ${result.message}\n\nPlease report this as a GitHub issue.`;
  }

  if (tab === 'compile_output') {
    return result?.status === 'compile_error'
      ? (result.message ?? '')
      : (result?.compilationMessage ?? '');
  }

  if (tab === 'stdout' || tab === 'stderr') return result?.[tab] ?? '';
  return '';
}

function ExecutionOutputPanel({
  children,
  result,
}: {
  children: React.ReactNode;
  result: JudgeResult | null;
}): JSX.Element {
  const executionTime =
    result?.status === 'time_limit_exceeded'
      ? '∞ms'
      : result?.time === undefined
        ? null
        : `${Math.round(result.time * 1000)}ms`;
  const memory =
    result?.status === 'memory_limit_exceeded'
      ? '∞MB'
      : result?.memory === undefined
        ? null
        : result.memory < 1000
          ? `${result.memory}kB`
          : `${Math.round(result.memory / 100) / 10}MB`;

  return (
    <div className="tw-forms-disable tw-forms-disable-all-descendants flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      {result && (
        <div
          className="border-t border-line-muted bg-panel-muted px-3 py-1.5 text-right font-mono text-xs tabular-nums text-content-muted"
          data-test-id="code-execution-output-status"
        >
          {[getJudgeStatusDescription(result), executionTime, memory]
            .filter(Boolean)
            .join(', ')}
        </div>
      )}
    </div>
  );
}

function OutputHistory({
  entries,
}: {
  entries: StatusHistoryEntry[];
}): JSX.Element {
  return (
    <div className="h-full w-full overflow-y-auto">
      <table className="table-tasks w-full border-b border-line text-content">
        <thead className="border-b border-line bg-panel-muted text-left text-xs uppercase tracking-wide text-content-muted">
          <tr>
            <th></th>
            <th>Verdict</th>
            <th>Time</th>
            <th>Memory</th>
            <th>Testcases</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line text-sm">
          {entries
            .slice()
            .reverse()
            .map((item, index) => {
              const verdict = getSubmissionStatusDisplay(item);
              const VerdictIcon = verdict.Icon;

              return (
                <tr
                  className="transition-colors hover:bg-surface-hover"
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
                      <VerdictIcon
                        className={`mr-1.5 inline h-3.5 w-3.5 ${verdict.colorClass} ${verdict.standaloneClass}`}
                      />
                      {item.message}
                      {item.link && (
                        <ArrowTopRightOnSquareIcon className="ml-1.5 inline h-3.5 w-3.5" />
                      )}
                    </a>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{item.time ?? '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{item.memory ?? '-'}</td>
                  <td>
                    <div className="flex flex-wrap">
                      {item.testCases?.map((testCase, index) => {
                        const display = getTestCaseStatusDisplay(
                          testCase.title
                        );
                        const TestCaseIcon = display.Icon;

                        return (
                          <TestCaseIcon
                            title={display.label}
                            className={`mr-0.5 inline h-3.5 w-3.5 ${display.colorClass} ${display.standaloneClass}`}
                            key={index}
                          />
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

export const Output = ({
  result,
  statusData,
  statusDataHistory,
}: OutputProps): JSX.Element => {
  const [selection, setSelection] = useState<OutputSelection>(() => {
    const selectedId = statusData ? 'results' : getDefaultOutputTab(result);
    return { result, statusData, selectedId, acknowledged: [selectedId] };
  });
  const resultChanged = !isSameOutput(selection.result, result);
  const statusChanged = selection.statusData !== statusData;
  let currentSelection = selection;

  if (resultChanged || statusChanged) {
    const selectedId =
      statusChanged && statusData ? 'results' : getDefaultOutputTab(result);
    currentSelection = {
      result,
      statusData,
      selectedId,
      acknowledged: resultChanged ? [selectedId] : selection.acknowledged,
    };
    setSelection(currentSelection);
  }

  const history = statusDataHistory ?? [];
  const isHighlighted = (id: OutputTab, hasOutput: boolean): boolean =>
    hasOutput && !currentSelection.acknowledged.includes(id);

  const { userData } = useUserContext();
  const mainMonacoEditor = useAtomValue(mainMonacoEditorAtom);

  return (
    <TabBar
      selectedId={currentSelection.selectedId}
      onSelectionChange={selectedId => {
        setSelection(current => ({
          ...current,
          selectedId,
          acknowledged: current.acknowledged.includes(selectedId)
            ? current.acknowledged
            : [...current.acknowledged, selectedId],
        }));
      }}
      ariaLabel="Program output"
      panelsClassName="min-h-0 flex-1 overflow-hidden bg-canvas text-content shadow-inner"
    >
      <TabBar.Item
        id="stdout"
        label="stdout"
        highlight={isHighlighted('stdout', Boolean(result?.stdout))}
      >
        <ExecutionOutputPanel result={result}>
          <CodeEditor
            theme={userData.lightMode ? 'light' : 'dark'}
            language="plaintext"
            value={getOutputText(result, 'stdout')}
            saveViewState={false}
            path="output"
            editorOptions={{
              readOnly: true,
              insertSpaces: true,
              fontSize: userData.fontSize,
            }}
          />
        </ExecutionOutputPanel>
      </TabBar.Item>
      <TabBar.Item
        id="stderr"
        label="stderr"
        highlight={isHighlighted('stderr', Boolean(result?.stderr))}
      >
        <ExecutionOutputPanel result={result}>
          <StderrOutput
            output={getOutputText(result, 'stderr')}
            lightMode={userData.lightMode}
          />
        </ExecutionOutputPanel>
      </TabBar.Item>
      <TabBar.Item
        id="compile_output"
        label="compile output"
        highlight={isHighlighted(
          'compile_output',
          Boolean(result?.compilationMessage)
        )}
      >
        <ExecutionOutputPanel result={result}>
          <CompilerOutput
            output={getOutputText(result, 'compile_output')}
            highlightLine={line => mainMonacoEditor?.setLineHighlight(line)}
            clearLineHighlight={() => mainMonacoEditor?.clearLineHighlight()}
          />
        </ExecutionOutputPanel>
      </TabBar.Item>
      {statusData && (
        <TabBar.Item id="results" label="results">
          <div className="h-full overflow-y-auto px-4">
            <USACOResults data={statusData} />
          </div>
        </TabBar.Item>
      )}
      {history.length > 0 && (
        <TabBar.Item id="history" label="history">
          <OutputHistory entries={history} />
        </TabBar.Item>
      )}
    </TabBar>
  );
};
