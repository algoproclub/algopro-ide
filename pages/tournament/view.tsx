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
import Split from 'react-split-grid';
import WithAdminLogin from '../../src/components/WithAdminLogin';

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
            editorOptions={{
              tabSize: 4,
              insertSpaces: false,
              readOnly: true,
            }}
            onReady={e => {
              setTimeout(() => {
                e.layout();
                e.focus();
              }, 0);
            }}
            yjsDocumentId={`${fileData.id}.${lang}`}
            useEditorWithVim={true}
            dataTestId="code-editor"
          />
        )}
      </div>
      <p className="text-sm font-mono text-gray-200 pl-4 status-node" />
    </div>
  );
};

const ResultView = ({ startTime }: { startTime: number }) => {
  const { fileData } = useEditorContext();
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [submissionTime, setSubmissionTime] = useState<number>(0);

  useEffect(() => {
    onValue(ref(db, `submissions/${fileData.id}`), (snapshot: DataSnapshot) => {
      if (snapshot.exists()) {
        setSubmissionTime(snapshot.val().submissionTime);
        setStatusData(snapshot.val().statusData);
      }
    });
    return () => {
      off(ref(db, `submissions/${fileData.id}`));
    };
  }, []);

  return (
    <div className="px-4 overflow-y-auto bg-gray-900">
      {statusData ? (
        <USACOResults
          data={statusData}
          submissionTime={submissionTime}
          startTime={startTime}
        />
      ) : (
        <div className="font-semibold text-gray-400 p-4 text-[0.92rem]">
          No submission yet.
        </div>
      )}
    </div>
  );
};

const SolutionViewContent = ({
  startTime,
  participants,
  selectedFileID,
  onFileChange,
}: {
  startTime: number;
  participants: { name: string; fileID: string }[];
  selectedFileID: string;
  onFileChange: (fileID: string) => void;
}) => {
  return (
    <div className="flex flex-col min-h-0 overflow-hidden w-full">
      <div className="px-4 py-2 border-b border-gray-600 font-semibold text-gray-400 bg-gray-900 min-h-0 truncate flex items-center justify-between">
        <div className="relative w-full">
          <select
            className="appearance-none bg-gray-800 border border-gray-600 rounded-md p-2 text-sm text-white hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition w-full"
            value={selectedFileID}
            onChange={e => onFileChange(e.target.value)}
          >
            {participants.map(participant => (
              <option key={participant.fileID} value={participant.fileID}>
                {participant.name}
              </option>
            ))}
          </select>
        </div>
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
            <ResultView startTime={startTime} />
          </div>
        )}
      />
    </div>
  );
};

export const SolutionView = ({
  fileID,
  startTime,
  participants,
  onFileChange,
}: {
  fileID: string;
  startTime: number;
  participants: { name: string; fileID: string }[];
  onFileChange: (fileID: string) => void;
}): JSX.Element => {
  return (
    <EditorProvider
      fileId={`-${fileID}`}
      loadingUI={<></>}
      fileNotFoundUI={<></>}
      permissionDeniedUI={<></>}
    >
      <SolutionViewContent
        startTime={startTime}
        participants={participants}
        selectedFileID={fileID}
        onFileChange={onFileChange}
      />
    </EditorProvider>
  );
};

const getDisplayName = async (participant: {
  fileID: string;
}): Promise<string> => {
  const fileUserSnapshot = await get(
    ref(db, `files/${participant.fileID}/users`)
  );
  const users = fileUserSnapshot.val();
  const user = Object.values(users).find(
    user => (user as { permission: string }).permission === 'OWNER'
  ) as { name: string } | undefined;
  return user ? user.name : 'Unknown';
};

const SpectatePage = () => {
  const router = useRouter();
  const { userData } = useNullableUserContext();
  const { left, middle, right } = router.query;

  const [files, setFiles] = useState<string[]>(
    [left, middle, right].filter(x => x) as string[]
  );
  const [startTime] = useState(0);
  const [participants, setParticipants] = useState<
    { name: string; fileID: string }[]
  >([]);

  useEffect(() => {
    if (files.length > 0) return;

    const fetchFiles = async () => {
      const participantsSnapshot = await get(
        ref(db, 'tournaments/latestID/participants')
      );
      const participantsData = participantsSnapshot.val() as {
        [userName: string]: { fileID: string };
      };

      const participantList = await Promise.all(
        Object.entries(participantsData).map(async ([, data]) => {
          const displayName = await getDisplayName({ fileID: data.fileID });
          return {
            name: displayName,
            fileID: data.fileID.slice(1),
          };
        })
      );
      setParticipants(participantList);
      setFiles(participantList.slice(0, 3).map(p => p.fileID));
    };

    fetchFiles();
  }, []);

  if (!userData || !startTime) {
    return <></>;
  }

  return (
    <WithAdminLogin>
      <div className="h-full w-full flex divide-x divide-gray-700">
        <SolutionView
          fileID={files?.[0]}
          startTime={startTime}
          participants={participants}
          onFileChange={newFileID =>
            setFiles(prev => [newFileID, prev[1], prev[2]])
          }
        />
        <SolutionView
          fileID={files?.[1]}
          startTime={startTime}
          participants={participants}
          onFileChange={newFileID =>
            setFiles(prev => [prev[0], newFileID, prev[2]])
          }
        />
        <SolutionView
          fileID={files?.[2]}
          startTime={startTime}
          participants={participants}
          onFileChange={newFileID =>
            setFiles(prev => [prev[0], prev[1], newFileID])
          }
        />
      </div>
    </WithAdminLogin>
  );
};

export default SpectatePage;
