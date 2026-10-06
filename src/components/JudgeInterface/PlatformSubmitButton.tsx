import { useAtomValue } from 'jotai';
import React, { useState } from 'react';
import { mainEditorValueAtom } from '../../atoms/workspace';
import { Platform, StatusData } from '../../types/problem';
import SubmitButton from './SubmitButton';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useEditorContext } from '../../context/EditorContext';
import { ProblemSolution, SubmissionData } from '../../types/problem';
import { useUserContext } from '../../context/UserContext';
import LoadResultsModal from './LoadResultsModal';
import { problemAtom } from '../../atoms/workspaceUI';
import { buildYosupoUrl } from '../../scripts/problemUtils';

const submitProblemSolution = httpsCallable<ProblemSolution, SubmissionData>(
  getFunctions(undefined, 'europe-west1'),
  'submitproblemsolution'
);

export const GenericSubmitButton = ({
  statusData,
  setStatusData,
}: {
  statusData: StatusData | null;
  setStatusData: React.Dispatch<React.SetStateAction<StatusData | null>>;
}): JSX.Element => {
  const { fileData } = useEditorContext();
  const { userData } = useUserContext();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const problem = useAtomValue(problemAtom)!;
  const getMainEditorValue = useAtomValue(mainEditorValueAtom)!;

  const handleSubmit = async () => {
    const getSubmitLink = () => {
      const platform = problem.platform;
      const problemID = problem.id;
      let submitLink = '';
      if (platform === 'codeforces') {
        let cfProblemID = problemID;
        if (cfProblemID.startsWith('gym')) {
          cfProblemID = problemID.replace('gym', '');
        }
        submitLink = `https://codeforces.com/problemset/submit?submittedProblemCode=${cfProblemID}`;
      }
      if (platform === 'njudge') {
        submitLink = `https://njudge.hu/problemset/main/${problemID}/`;
      }
      if (platform === 'spoj') {
        submitLink = `https://www.spoj.com/problems/${problemID}/`;
      }
      if (platform === 'atcoder') {
        submitLink = `https://atcoder.jp/contests/${
          problemID.split('_')[0]
        }/tasks/${problemID}`;
      }
      if (platform === 'cses') {
        submitLink = `https://cses.fi/problemset/submit/${problemID}/`;
      }
      if (platform === 'yosupo') {
        submitLink = buildYosupoUrl(problemID);
      }
      return submitLink;
    };
    // Use only manual submission for codeforces and atcoder. This is temporary, should be reverted
    // when we manage to fix automatic submission.
    if (
      userData.manualSubmission ||
      problem.platform === 'codeforces' ||
      problem.platform === 'atcoder'
    ) {
      if (!['cses', 'planets'].includes(problem.platform)) {
        const link = getSubmitLink();
        window.open(link, '_blank');
        setIsOpen(true);
      } else {
        alert(`This platform does not support manual submission.`);
      }
    } else {
      setStatusData({
        statusCode: 'starting',
        message: 'starting',
        statusText: null,
        link: null,
        time: null,
        memory: null,
        output: null,
        testCases: null,
      });
      const lastAllowedTime = performance.now() + 5000;

      while (true) {
        try {
          const submissionData = await submitProblemSolution({
            fileID: fileData.id,
            platform: problem.platform,
            problemID: problem.id,
            language: fileData.settings.language,
            sourceCode: getMainEditorValue(),
          });
          console.log('submission success', submissionData);
          break;
        } catch (error) {
          console.error(error);
          if (performance.now() > lastAllowedTime) {
            setStatusData({
              statusCode: 'error',
              message: 'Error submitting solution, please try again',
              statusText: null,
              link: null,
              time: null,
              memory: null,
              output: null,
              testCases: null,
            });
            break;
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
      }
    }
  };
  const userPermission =
    fileData.users[userData.id]?.permission ??
    fileData.settings.defaultPermission;

  return (
    <>
      <LoadResultsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        setStatusData={setStatusData}
      />
      <SubmitButton
        isLoading={['starting', 'working'].includes(
          statusData?.statusCode ?? ''
        )}
        isDisabled={
          ['PRIVATE', 'READ'].includes(userPermission) || !problem.submittable
        }
        onClick={handleSubmit}
      />
    </>
  );
};

export const PlatformSubmitButton = ({
  platform,
  statusData,
  setStatusData,
}: {
  platform: Platform;
  statusData: StatusData | null;
  setStatusData: React.Dispatch<React.SetStateAction<StatusData | null>>;
}): JSX.Element => {
  return platform === 'usaco' ? (
    // TODO: implement UsacoSubmitButton
    <></>
  ) : (
    <GenericSubmitButton
      statusData={statusData}
      setStatusData={setStatusData}
    />
  );
};
