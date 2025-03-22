import { useAtomValue } from 'jotai';
import React, { useState, useEffect, useRef } from 'react';
import { mainEditorValueAtom } from '../../atoms/workspace';
import { Platform, StatusData } from '../../types/problem';
import SubmitButton from './SubmitButton';
import { PlayCircleIcon } from '@heroicons/react/20/solid';
import { getFirestore, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useEditorContext } from '../../context/EditorContext';
import {
  ProblemData,
  ProblemSolution,
  SubmissionData,
} from '../../types/problem';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { useUserContext } from '../../context/UserContext';
import LoadResultsModal from './LoadResultsModal';
import { registerSubmission } from '../../scripts/updateStatus';
import 'katex/dist/katex.min.css';
import renderMathInElement from 'katex/contrib/auto-render';
import katex from 'katex';
import { problemAtom } from '../../atoms/workspaceUI';

const submitProblemSolution = httpsCallable<ProblemSolution, SubmissionData>(
  getFunctions(undefined, 'europe-west1'),
  'submitproblemsolution'
);

export const GenericSubmitButton = ({
  platform,
  statusData,
  setStatusData,
}: {
  platform: Platform;
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
        submitLink = `https://codeforces.com/problemset/submit?submittedProblemCode=${problemID}`;
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
      return submitLink;
    };
    if (userData.manualSubmission) {
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
            platform: problem.platform,
            problemID: problem.id,
            language: fileData.settings.language,
            sourceCode: getMainEditorValue(),
          });
          registerSubmission(
            fileData.id,
            submissionData.data.id,
            submissionData.data.username,
            setStatusData
          );
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
      platform={platform}
      statusData={statusData}
      setStatusData={setStatusData}
    />
  );
};
