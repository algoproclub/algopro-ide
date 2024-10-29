import { useRouter } from 'next/router';
import {
  EditorProvider,
  FileData,
  useEditorContext,
} from '../../src/context/EditorContext';
import React, { useCallback, useEffect, useState } from 'react';
import classNames from 'classnames';
import { LazyRealtimeEditor } from '../../src/components/RealtimeEditor/LazyRealtimeEditor';
import {
  DataSnapshot,
  get,
  getDatabase,
  off,
  onValue,
  ref,
} from 'firebase/database';
import { useNullableUserContext } from '../../src/context/UserContext';
import { StatusData } from '../../src/types/problem';
import USACOResults from '../../src/components/JudgeInterface/USACOResults';
import * as monaco from 'monaco-editor';
import Split from 'react-split-grid';
import { EllipsisHorizontalIcon } from '@heroicons/react/20/solid';
import WithTeacherLogin from '../../src/components/WithTeacherLogin';

const db = getDatabase();

const CodeView = () => {
  const { fileData } = useEditorContext();
  const lang = fileData.settings.language;
  return (
    <div className="h-full w-full relative">
      <div className="absolute inset-0">
        {fileData && lang && (
          <LazyRealtimeEditor
            theme={'dark'}
            language={{ cpp: 'cpp', java: 'java', py: 'python' }[lang]}
            path={`${fileData.id}.${lang}`}
            options={
              {
                minimap: { enabled: false },
                tabSize: 4,
                insertSpaces: false,
                readOnly: true,
                'bracketPairColorization.enabled': true,
                acceptSuggestionOnCommitCharacter: false,
              } as any
            }
            onMount={e => {
              setTimeout(() => {
                e.layout();
                e.focus();
              }, 0);
            }}
            yjsDocumentId={`${fileData.id}.${lang}`}
            useEditorWithVim={true}
            lspEnabled={false}
            dataTestId="code-editor"
          />
        )}
      </div>
      <p className="text-sm font-mono text-gray-200 pl-4 status-node" />
    </div>
  );
};

const ResultView = () => {
  const { fileData } = useEditorContext();
  const [statusData, setStatusData] = useState<StatusData | null>(null);

  useEffect(() => {
    onValue(
      ref(db, `submissions/${fileData.id}/statusData`),
      (snapshot: DataSnapshot) => {
        setStatusData(snapshot.val());
      }
    );
    return () => {
      off(ref(db, `submissions/${fileData.id}/statusData`));
    };
  }, []);

  return (
    <div className="px-4 overflow-y-auto">
      {statusData ? (
        <USACOResults data={statusData} />
      ) : (
        <div className="font-semibold text-gray-400 p-4">
          No submission yet.
        </div>
      )}
    </div>
  );
};

const SolutionViewContent = () => {
  const { fileData } = useEditorContext();
  const owner = Object.values(
    Object.fromEntries(
      Object.entries(fileData.users).filter(
        ([k, v]) => v.permission === 'OWNER'
      )
    )
  )[0];
  return (
    <div className="flex flex-col min-h-0 overflow-hidden w-full">
      <div className="px-4 py-2 border-b border-gray-600 font-semibold text-gray-400 bg-gray-900 min-h-0 overflow-hidden">
        {owner?.name}
      </div>
      <Split
        render={({ getGridProps, getGutterProps }) => (
          <div
            className={`grid grid-rows-[2fr,3px,1fr] w-full h-full min-h-0`}
            {...getGridProps()}
          >
            <CodeView />
            <div
              className={classNames(
                'cursor-[row-resize] group relative z-10 my-[-6px]'
              )}
              {...getGutterProps('row', 1)}
            >
              <div
                className={classNames(
                  'absolute w-full bg-gray-700 group-hover:bg-gray-600 group-active:bg-gray-600 group-focus:bg-gray-600 pointer-events-none transition',
                  'top-[7px] bottom-[7px]'
                )}
              ></div>
            </div>
            <ResultView />
          </div>
        )}
      />
    </div>
  );
};

export const SolutionView = ({ fileID }: { fileID: string }): JSX.Element => {
  return (
    <EditorProvider
      fileId={`-${fileID}`}
      loadingUI={<></>}
      fileNotFoundUI={<></>}
      permissionDeniedUI={<></>}
    >
      <SolutionViewContent />
    </EditorProvider>
  );
};

const SpectatePage = () => {
  const router = useRouter();
  const { userData } = useNullableUserContext();
  const { left, middle, right } = router.query;

  if (!userData) {
    return <></>;
  }
  return (
    <WithTeacherLogin>
      <div className="h-full w-full flex divide-x divide-gray-700">
        <SolutionView fileID={left as string} />
        <SolutionView fileID={middle as string} />
        <SolutionView fileID={right as string} />
      </div>
    </WithTeacherLogin>
  );
};

export default SpectatePage;
