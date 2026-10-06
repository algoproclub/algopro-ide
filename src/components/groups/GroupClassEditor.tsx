import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getDefaultStore } from 'jotai/vanilla';
import type { Platform, ProblemData, URLProblem } from '../../types/problem';
import { EditTextAreaModal } from '../EditTextModal';
import ManualProblemDataModal from '../ManualProblemDataModal';
import Tooltip from '../Tooltip';
import {
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  PencilSquareIcon,
  PlusIcon,
  PlayIcon,
  TrashIcon,
} from '@heroicons/react/20/solid';
import { DragDropProvider, type DragEndEvent } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import { getPlatformName } from '../../scripts/getPlatformName';
import { parseProblem } from '../../scripts/parseProblem';
import TaskLibraryPicker from './TaskLibraryPicker';
import type { GroupClassData } from '../../data/classroomMetadata';
import RefreshButton from '../RefreshButton';
import { problemLibraryAtom } from '../../atoms/problemLibrary';
import type { ClassroomResourceStatus } from '../../hooks/useClassroomMetadata';

export type GroupClassUpdate =
  | GroupClassData
  | ((current: GroupClassData) => GroupClassData);

const extractTaskUrls = (text: string) =>
  Array.from(
    new Set(
      (text.match(/https?:\/\/[^\s<>"']+|\/solve\/[^\s<>"']+/g) ?? []).map(
        match => {
          const url = match.replace(/[),.;:]+$/, '');
          return url.startsWith('/solve/')
            ? new URL(
                url,
                process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin
              ).toString()
            : url;
        }
      )
    )
  );

const resolveTaskLinks = async (
  text: string
): Promise<{ ok: boolean; task: URLProblem }[]> => {
  const taskUrls = extractTaskUrls(text);
  const parsedTasks = taskUrls.map(parseProblem);
  const library = await getDefaultStore()
    .get(problemLibraryAtom)
    .catch(() => []);
  const libraryByKey = new Map(
    library.map(problem => [`${problem.platform}:${problem.id}`, problem])
  );

  return Promise.all(
    parsedTasks.map(
      async (task): Promise<{ ok: boolean; task: URLProblem }> => {
        if (!task.platform || !task.id) return { ok: false, task };
        const libraryTask = libraryByKey.get(`${task.platform}:${task.id}`);
        if (libraryTask)
          return { ok: true, task: { ...task, title: libraryTask.title } };

        try {
          const response = await fetch('/api/fetchProblemData', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: task.platform, id: task.id }),
          });
          if (!response.ok) return { ok: false, task };
          const problem = (await response.json()) as { title?: unknown } | null;
          if (typeof problem?.title !== 'string') return { ok: false, task };
          return { ok: true, task: { ...task, title: problem.title } };
        } catch {
          return { ok: false, task };
        }
      }
    )
  );
};

const TaskAdder = ({
  onAddTasks,
  disabled,
}: {
  onAddTasks: (tasks: URLProblem[]) => void;
  disabled: boolean;
}) => {
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [pendingManualEntry, setPendingManualEntry] = useState<{
    platform: Platform;
    id: string;
    resolve: (problem: ProblemData | null) => void;
  } | null>(null);
  const pasteRequestID = useRef(0);

  useEffect(
    () => () => {
      pasteRequestID.current += 1;
    },
    []
  );
  useEffect(() => {
    if (disabled) pasteRequestID.current += 1;
  }, [disabled]);

  const promptManualEntry = (platform: Platform, id: string) =>
    new Promise<ProblemData | null>(resolve => {
      setPendingManualEntry({ platform, id, resolve });
    });

  const addPastedTasks = async (text: string) => {
    if (disabled) return;
    const requestID = ++pasteRequestID.current;
    const results = await resolveTaskLinks(text);
    if (requestID !== pasteRequestID.current) return;

    // Ask about each task we couldn't fetch automatically, one at a time,
    // so the user can paste its page HTML manually or skip it. Close this
    // modal first: two Headless UI dialogs open at once (this one and the
    // manual-entry one) confuses their focus traps and swallows clicks.
    if (
      results.some(
        result => !result.ok && result.task.platform && result.task.id
      )
    ) {
      setIsPasteModalOpen(false);
    }
    // Keep the original link order: automatically resolved and manually
    // resolved tasks are interleaved here rather than appended separately.
    const tasks: URLProblem[] = [];
    const skippedUrls: string[] = [];
    for (const result of results) {
      if (result.ok) {
        tasks.push(result.task);
        continue;
      }
      const { task } = result;
      if (!task.platform || !task.id) {
        skippedUrls.push(task.url);
        continue;
      }
      const problem = await promptManualEntry(task.platform, task.id);
      if (requestID !== pasteRequestID.current) return;
      if (problem) tasks.push({ ...task, title: problem.title });
      else skippedUrls.push(task.url);
    }

    if (!tasks.length) {
      alert('No supported task links were found in the pasted text.');
      return;
    }
    if (skippedUrls.length) {
      alert(`Skipped these links:\n${skippedUrls.join('\n')}`);
    }
    onAddTasks(tasks);
    setPastedText('');
    setIsPasteModalOpen(false);
  };

  return (
    <div className="relative">
      <EditTextAreaModal
        isOpen={isPasteModalOpen}
        text={pastedText}
        title="Add tasks from pasted links"
        setText={setPastedText}
        onSave={addPastedTasks}
        onClose={() => {
          pasteRequestID.current += 1;
          setIsPasteModalOpen(false);
        }}
      />
      <ManualProblemDataModal
        isOpen={pendingManualEntry !== null}
        platform={pendingManualEntry?.platform ?? 'codeforces'}
        problemID={pendingManualEntry?.id ?? ''}
        onSuccess={problem => {
          pendingManualEntry?.resolve(problem);
          setPendingManualEntry(null);
        }}
        onClose={() => {
          pendingManualEntry?.resolve(null);
          setPendingManualEntry(null);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          className="ui-button-secondary"
          onClick={() => setIsPasteModalOpen(true)}
          disabled={disabled}
        >
          Add tasks with links
        </button>
        <button
          className="ui-button border-transparent bg-success text-content-inverted enabled:hover:bg-status-success"
          onClick={() => setIsLibraryOpen(open => !open)}
          disabled={disabled}
        >
          Add from library
        </button>
      </div>
      {isLibraryOpen && !disabled && (
        <div className="absolute right-0 top-full z-20 mt-2 w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-line shadow-xl">
          <TaskLibraryPicker
            onClose={() => setIsLibraryOpen(false)}
            onAdd={task => {
              onAddTasks([task]);
              setIsLibraryOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
};

const SortableTaskRow = ({
  id,
  index,
  task,
  isAdmin,
  onDelete,
  disabled,
}: {
  id: string;
  index: number;
  task: URLProblem;
  isAdmin: boolean;
  onDelete: () => void;
  disabled: boolean;
}) => {
  const { ref, handleRef, isDragging } = useSortable({
    id,
    index,
    disabled,
  });

  return (
    <div
      ref={ref}
      className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
        isDragging
          ? 'relative z-10 bg-surface-raised text-content shadow-lg'
          : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip label="Drag to reorder">
          <button
            ref={handleRef}
            type="button"
            aria-label="Drag to reorder"
            className="ui-focus cursor-grab touch-none rounded-md p-1.5 text-content-muted hover:bg-surface-hover hover:text-content active:cursor-grabbing"
            disabled={disabled}
          >
            <Bars3Icon className="h-4 w-4" />
          </button>
        </Tooltip>
        <div className="min-w-0">
          <p className="truncate font-medium">
            {task.title ?? task.id ?? task.url}
          </p>
          <p className="text-xs text-content-muted">
            {task.platform
              ? `${getPlatformName(task.platform)} · ${task.id}`
              : task.url}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Tooltip label="Open original problem">
          <Link
            href={task.url}
            target="_blank"
            rel="noreferrer"
            className="ui-icon-button"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </Link>
        </Tooltip>
        {task.platform && task.id && (
          <>
            <Tooltip label="Solve">
              <Link
                href={`/solve/${task.platform}/${task.id}`}
                target="_blank"
                className="ui-icon-button"
              >
                <PlayIcon className="h-4 w-4" />
              </Link>
            </Tooltip>
            {isAdmin && (
              <Tooltip label="Edit problem">
                <Link
                  href={`/edit/${task.platform}/${task.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-icon-button"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                </Link>
              </Tooltip>
            )}
          </>
        )}
        <Tooltip label="Delete task">
          <button
            type="button"
            className="ui-icon-button"
            onClick={onDelete}
            disabled={disabled}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

const ClassEditor = ({
  classID,
  group,
  data,
  unsaved,
  onDelete,
  onSave,
  onCancel,
  onUpdate,
  isAdmin,
  disabled,
  isMutating,
}: {
  classID: string;
  group: string;
  data: GroupClassData;
  unsaved: boolean;
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdate: (update: GroupClassUpdate) => void;
  isAdmin: boolean;
  disabled: boolean;
  isMutating: boolean;
}) => {
  const taskIDCounts = new Map<string, number>();
  const taskRows = data.tasks.map(task => {
    const baseID = `${task.platform}:${task.id}:${task.url}`;
    const occurrence = taskIDCounts.get(baseID) ?? 0;
    taskIDCounts.set(baseID, occurrence + 1);
    return { id: `${baseID}:${occurrence}`, task };
  });
  const reorderTasks = ({ canceled, operation }: DragEndEvent) => {
    const { source } = operation;
    if (disabled || canceled || !isSortable(source)) return;
    const oldIndex = source.initialIndex;
    const newIndex = source.index;
    if (
      oldIndex === newIndex ||
      oldIndex < 0 ||
      oldIndex >= taskRows.length ||
      newIndex < 0 ||
      newIndex >= taskRows.length
    )
      return;
    onUpdate(current => {
      const tasks = [...current.tasks];
      const [task] = tasks.splice(oldIndex, 1);
      if (!task) return current;
      tasks.splice(newIndex, 0, task);
      return { ...current, tasks };
    });
  };

  const copyContent = () => {
    const groupIDWithoutSchool = group.split('~').pop() || group;
    const prefix = `${groupIDWithoutSchool[0].toUpperCase()}.${classID}`;
    const text = data.tasks
      .map(
        (task, index) =>
          `${prefix}.${index + 1}. ${task.title ?? '-'}\n${process.env.NEXT_PUBLIC_BASE_URL}/solve/${task.platform}/${task.id}`
      )
      .join('\n\n');
    navigator.clipboard
      .writeText(text)
      .catch(() => alert("Couldn't copy to clipboard"));
  };

  return (
    <article className="overflow-visible rounded-lg border border-line bg-surface-raised text-content">
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <div>
          <h1 className="font-semibold">Class {classID}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm text-content-muted">
              {data.tasks.length} task{data.tasks.length === 1 ? '' : 's'}
            </p>
            {unsaved && (
              <span className="inline-flex rounded-full bg-status-warning-surface px-2 py-0.5 text-xs font-medium text-status-warning-content">
                Unsaved changes
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="ui-button-secondary" onClick={copyContent}>
            Copy list
          </button>
          <TaskAdder
            disabled={disabled}
            onAddTasks={tasks =>
              onUpdate(current => ({
                ...current,
                tasks: [...current.tasks, ...tasks],
              }))
            }
          />
          <button
            type="button"
            className="ui-button-primary px-4 py-2"
            onClick={onSave}
            disabled={!unsaved || disabled}
          >
            {isMutating ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </header>
      <div className="divide-y divide-line-muted bg-surface text-content">
        {data.tasks.length ? (
          <DragDropProvider onDragEnd={reorderTasks}>
            {taskRows.map(({ id, task }, index) => (
              <SortableTaskRow
                key={id}
                id={id}
                index={index}
                task={task}
                isAdmin={isAdmin}
                disabled={disabled}
                onDelete={() =>
                  onUpdate(current => ({
                    ...current,
                    tasks: current.tasks.filter(
                      (_, itemIndex) => itemIndex !== index
                    ),
                  }))
                }
              />
            ))}
          </DragDropProvider>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-content-muted">
            No tasks yet. Add one from the library or paste a task URL.
          </p>
        )}
      </div>
      <footer className="flex items-center justify-between border-t border-line px-3 py-2.5">
        <button
          className="ui-button border-transparent bg-danger text-content-inverted enabled:hover:bg-status-danger"
          onClick={onDelete}
          disabled={disabled}
        >
          Delete class
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="ui-button-secondary py-2"
            onClick={onCancel}
            disabled={!unsaved || disabled}
          >
            Cancel
          </button>
          <button
            className="ui-button-primary px-4 py-2"
            onClick={onSave}
            disabled={!unsaved || disabled}
          >
            {isMutating ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </footer>
    </article>
  );
};

export default function GroupClassEditor({
  group,
  selectedClassID,
  classes,
  isClassDirty,
  onUpdateClass,
  onSaveClass,
  onDiscardClassChanges,
  onDeleteClass,
  isAdmin,
  isReady,
  onNewClass,
  status,
  isRefreshing,
  mutatingClassID,
  hasUnsavedChanges,
  onRefresh,
}: {
  group: string;
  selectedClassID: string | null;
  classes: Record<string, GroupClassData>;
  isClassDirty: (id: string) => boolean;
  onUpdateClass: (id: string, update: GroupClassUpdate) => void;
  onSaveClass: (id: string) => Promise<boolean>;
  onDiscardClassChanges: (id: string) => void;
  onDeleteClass: (id: string) => void;
  isAdmin: boolean;
  isReady: boolean;
  onNewClass: () => void;
  status: ClassroomResourceStatus;
  isRefreshing: boolean;
  mutatingClassID: string | null;
  hasUnsavedChanges: boolean;
  onRefresh: () => void;
}) {
  const selectedClass = selectedClassID ? classes[selectedClassID] : undefined;
  const isEditingDisabled = isRefreshing || mutatingClassID !== null;
  const hasError = status === 'error';

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between rounded-lg border border-line bg-surface-raised px-3 py-2.5 text-content">
        <div>
          <h1 className="font-semibold">Class editor</h1>
          <p className="text-sm text-content-muted">
            Manage this group’s tasks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton
            title={
              mutatingClassID
                ? 'Wait for the class operation to finish'
                : hasUnsavedChanges
                  ? 'Save or cancel class changes before refreshing'
                  : 'Refresh classes'
            }
            onClick={onRefresh}
            disabled={hasUnsavedChanges || mutatingClassID !== null}
            isLoading={isRefreshing || (!isReady && !hasError)}
          />
          <button
            type="button"
            className="ui-button-primary py-2"
            onClick={onNewClass}
            disabled={!isReady || isEditingDisabled}
          >
            <PlusIcon className="h-4 w-4" />
            New class
          </button>
        </div>
      </header>
      {hasError && (
        <p className="rounded-lg border border-danger px-4 py-3 text-sm text-danger">
          Classes could not be loaded. Try refreshing them.
        </p>
      )}
      {!isReady ? (
        !hasError && (
          <div className="rounded-lg border border-dashed border-line px-4 py-12 text-center text-sm text-content-muted">
            Loading classes…
          </div>
        )
      ) : selectedClassID && selectedClass ? (
        <ClassEditor
          key={`${group}/${selectedClassID}`}
          classID={selectedClassID}
          group={group}
          data={selectedClass}
          unsaved={isClassDirty(selectedClassID)}
          onDelete={() => onDeleteClass(selectedClassID)}
          onSave={() => {
            void onSaveClass(selectedClassID)
              .then(saved => {
                if (!saved)
                  alert(
                    'A class with this ID was created by someone else. Refresh classes and choose another ID.'
                  );
              })
              .catch(error => {
                console.error(error);
                alert('The class could not be saved.');
              });
          }}
          onCancel={() => onDiscardClassChanges(selectedClassID)}
          onUpdate={data => onUpdateClass(selectedClassID, data)}
          isAdmin={isAdmin}
          disabled={isEditingDisabled}
          isMutating={mutatingClassID === selectedClassID}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-line px-4 py-12 text-center text-sm text-content-muted">
          Create or select a class to start adding tasks.
        </div>
      )}
    </section>
  );
}
