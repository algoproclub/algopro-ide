import { useRouter } from 'next/router';
import {
  EditorProvider,
  useEditorContext,
} from '../../src/context/EditorContext';
import React, { useEffect, useState } from 'react';
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
import WithTeacherLogin from '../../src/components/WithTeacherLogin';
import { XMarkIcon } from '@heroicons/react/20/solid';

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

const WarningBanner = ({
  children,
}: {
  children?: React.ReactNode;
}): JSX.Element => {
  const [show, setShow] = useState(true);
  return (
    (show && (
      <div className="border border-yellow-500 bg-yellow-700 text-white px-4 py-3 m-2 rounded relative">
        <strong className="font-bold">Warning </strong>
        <span className="block sm:inline">{children}</span>
        <XMarkIcon
          className="h-6 w-6 absolute top-3 right-2 cursor-pointer"
          onClick={() => setShow(false)}
        />
      </div>
    )) || <></>
  );
};

const SpectatePage = () => {
  const router = useRouter();
  const { userData } = useNullableUserContext();
  const { left, middle, right } = router.query;

  const [files, setFiles] = useState<string[]>(
    [left, middle, right].filter(x => x) as string[]
  );

  console.log(files);
  useEffect(() => {
    if (files.length > 0) return;

    const fetchFiles = async () => {
      const latestIDSnapshot = await get(ref(db, 'tournaments/latestID'));
      const tournamentID = latestIDSnapshot.val();

      const participantsSnapshot = await get(
        ref(db, `tournaments/${tournamentID}/participants`)
      );
      const participants = participantsSnapshot.val() as {
        [userName: string]: { fileID: string };
      };

      const fileIDs = Object.entries(participants).map(([_, p]) =>
        p.fileID.slice(1)
      );
      setFiles(fileIDs);
    };

    fetchFiles();
  }, []);

  if (!userData) {
    return <></>;
  }

  return (
    <WithTeacherLogin>
      <>
        {files.length > 3 && (
          /* FIXME: Make user selection configurable when there are more than 3 participants. */
          <WarningBanner>
            There are more than 3 participants in this contest. Only the first 3
            are shown.
          </WarningBanner>
        )}
        <div className="h-full w-full flex divide-x divide-gray-700">
          <SolutionView fileID={files?.[0]} />
          <SolutionView fileID={files?.[1]} />
          <SolutionView fileID={files?.[2]} />
        </div>
      </>
    </WithTeacherLogin>
  );
};

export default SpectatePage;
