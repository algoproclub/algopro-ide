import { TabBar } from './TabBar';
import React, { useState, useEffect } from 'react';
import { useAtomValue } from 'jotai/utils';
import JudgeResult from '../types/judge';
import { EditorProps } from './editor/MonacoEditor/monaco-editor-types';
import USACOResults from './JudgeInterface/USACOResults';
import { StatusData } from './Workspace/Workspace';
import { useUserContext } from '../context/UserContext';
import { useEditorContext } from '../context/EditorContext';
import { CodeEditor } from './editor/CodeEditor';

export interface OutputProps {
  result: JudgeResult | null;
  statusData: StatusData | null;
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
  }, [result]);

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
          </div>
        ) : (
          <CodeEditor
            theme={lightMode ? 'light' : 'vs-dark'}
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
      <div
        className="text-sm font-mono text-right pr-4 text-gray-200"
        data-test-id="code-execution-output-status"
      >
        {option !== 'results' && result && (
          <>
            {result.statusDescription}, {result.time ?? '-'}s,{' '}
            {result.memory ?? '-'}KB
          </>
        )}
      </div>
    </>
  );
};
