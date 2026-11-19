import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/20/solid';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useSyncExternalStore } from 'react';
import { mainEditorHandleAtom } from '../atoms/workspace';
import { mobileActiveTabAtom } from '../atoms/workspaceUI';
import { useMediaQuery } from '../hooks/useMediaQuery';
import type { LLMDebugRun } from '../types/llmDebug';
import LoadingIndicator from './LoadingIndicator';
import Markdown from './JudgeInterface/Markdown';

const sectionHeadingClass =
  'mb-1 text-xs font-semibold uppercase tracking-wide text-content-muted';

// Mounted only while the AI Debug tab is active, so the flagged lines are
// highlighted in the editor exactly while it is open.
export default function LLMDebugPanel({
  run,
}: {
  run: LLMDebugRun;
}): JSX.Element {
  const editor = useAtomValue(mainEditorHandleAtom);
  const setMobileActiveTab = useSetAtom(mobileActiveTabAtom);
  const isDesktop = useMediaQuery('(min-width: 1024px)', true);

  const findings = run.status === 'done' ? run.result.findings : [];
  const subscribe = (onStoreChange: () => void) =>
    editor && findings.length > 0
      ? editor.onDidChangeContent(onStoreChange)
      : () => {};
  const code = useSyncExternalStore(
    subscribe,
    () => (findings.length > 0 ? (editor?.getValue() ?? '') : ''),
    () => ''
  );
  // Monaco follows the flagged lines through edits once they are handed to
  // it, which needs the code that was run; CodeMirror does not follow them.
  // Read as a store (JSON keeps the snapshot stable) so the list follows too.
  const tracked: number[] = JSON.parse(
    useSyncExternalStore(
      subscribe,
      () => JSON.stringify(editor?.getLLMBugHighlightLines() ?? []),
      () => '[]'
    )
  );
  const stale =
    tracked.length === 0 && code !== run.code && editor?.kind === 'monaco';
  const lines =
    tracked.length > 0 ? tracked : findings.map(finding => finding.line);

  useEffect(() => {
    if (!editor || run.status !== 'done' || run.result.findings.length === 0) {
      return;
    }
    if (editor.getLLMBugHighlightLines().length === 0 && code === run.code) {
      editor.setLLMBugHighlights(run.result.findings);
    }
  }, [editor, run, code]);

  useEffect(() => {
    if (!editor) return;
    editor.showLLMBugHighlights(true);
    return () => editor.showLLMBugHighlights(false);
  }, [editor]);

  let body: JSX.Element;
  if (run.status === 'loading') {
    body = (
      <p className="flex items-center gap-2 text-content-secondary">
        <LoadingIndicator className="mx-0 h-4 w-4" />
        The AI is reviewing the code…
      </p>
    );
  } else if (run.status === 'error') {
    body = (
      <p className="flex items-start gap-2 text-status-danger-content">
        <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">{run.message}</span>
      </p>
    );
  } else {
    const { result } = run;
    const VerdictIcon =
      result.verdict === 'correct' ? CheckCircleIcon : ExclamationTriangleIcon;
    body = (
      <div className="space-y-4">
        {result.statementWarning && (
          <p className="flex items-start gap-2 rounded-md bg-status-warning-surface px-3 py-2 text-status-warning-content">
            <ExclamationTriangleIcon
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            {result.statementWarning}
          </p>
        )}
        <p
          className={`flex items-start gap-2 font-semibold ${
            result.verdict === 'correct'
              ? 'text-status-success-content'
              : 'text-status-danger-content'
          }`}
        >
          <VerdictIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {result.verdict === 'correct'
            ? 'The AI found no problems — the code looks correct.'
            : 'The AI found problems in this code.'}
        </p>
        {result.summary.trim() !== '' && (
          <section>
            <h3 className={sectionHeadingClass}>Summary</h3>
            {/* Styles paragraphs, lists and the breaking-input code block. */}
            <div className="html-statement-container">
              <Markdown disallowedElements={['img']}>{result.summary}</Markdown>
            </div>
          </section>
        )}
        {findings.length > 0 ? (
          <section>
            <h3 className={sectionHeadingClass}>Flagged lines</h3>
            <ul className="space-y-1">
              {findings.map((finding, index) => {
                const line = lines[index];
                return (
                  <li key={`${finding.line}-${index}`}>
                    <button
                      type="button"
                      className="ui-focus flex w-full items-start gap-3 rounded-md border border-line px-3 py-2 text-left transition-colors enabled:hover:border-line-strong enabled:hover:bg-surface-hover enabled:active:bg-surface-active disabled:cursor-default disabled:opacity-60"
                      disabled={stale}
                      onClick={() => {
                        // On mobile the editor is a separate view.
                        if (!isDesktop) setMobileActiveTab('code');
                        editor?.revealLine(line);
                      }}
                    >
                      <span className="shrink-0 font-mono text-xs leading-5 text-status-danger-content">
                        Line {line}
                      </span>
                      <Markdown disallowedElements={['img']}>
                        {finding.reason}
                      </Markdown>
                    </button>
                  </li>
                );
              })}
            </ul>
            {/* The CodeMirror editor used on touch devices draws no line
                highlights, so the sentence would be false there. */}
            {editor?.kind === 'monaco' && (
              <p className="mt-2 text-xs text-content-muted">
                {stale
                  ? 'The code changed since the run, so the lines are not highlighted. Run Debug with AI again.'
                  : 'Flagged lines are highlighted in the editor while this tab is open.'}
              </p>
            )}
          </section>
        ) : (
          result.verdict === 'buggy' && (
            <p className="text-content-secondary">
              The AI did not tie the problem to a specific line; see the
              summary.
            </p>
          )
        )}
      </div>
    );
  }

  return (
    // Inline code in the AI's Markdown gets a subtle chip; code blocks get the
    // statement sample box (.html-statement-container pre).
    <div className="h-full overflow-y-auto p-4 text-sm text-content [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-surface-muted [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-0.5">
      {body}
    </div>
  );
}
