import {
  getStorage,
  ref as storageRef,
  getDownloadURL,
  getMetadata,
} from 'firebase/storage';
import { FirebaseError } from 'firebase/app';
import { PlatformProblem } from '../../types/problem';

export type TestcaseResult = {
  downloadURL: string;
  previewText: string;
};

type RawTestcaseResult = {
  downloadURL: string;
  fileSize: number;
};

const isStorageObjectNotFound = (error: unknown): boolean => {
  return (
    error instanceof FirebaseError && error.code === 'storage/object-not-found'
  );
};

const loadFirebaseTestcase = async (
  problem: PlatformProblem,
  kind: 'input' | 'output',
  trialNum: number
): Promise<RawTestcaseResult | null> => {
  const path = `testcases/${problem.platform}/${problem.id}/${kind}${trialNum - 1}.txt`;
  const ref = storageRef(getStorage(), path);
  let meta;
  let url;
  try {
    [meta, url] = await Promise.all([getMetadata(ref), getDownloadURL(ref)]);
  } catch (error) {
    if (isStorageObjectNotFound(error)) {
      return null;
    }
    throw error;
  }

  return {
    downloadURL: url,
    fileSize: meta.size,
  };
};

const loadNjudgeTestcase = async (
  problem: PlatformProblem,
  kind: 'input' | 'output',
  trialNum: number
): Promise<RawTestcaseResult | null> => {
  const downloadURL = `https://njudge.hu/testcases/${problem.id}/${kind}${trialNum - 1}.txt`;

  const res = await fetch(downloadURL, { method: 'HEAD' });
  if (!res.ok) {
    if (res.status === 404) {
      return null;
    }
    throw new Error(
      `Failed to fetch testcase: ${res.status} ${res.statusText}`
    );
  }

  const sizeInBytes = Number(res.headers.get('content-length'));
  if (isNaN(sizeInBytes)) {
    throw new Error('Failed to get testcase size from headers');
  }

  return {
    downloadURL,
    fileSize: sizeInBytes,
  };
};

export default async function fetchTestCase(
  problem: PlatformProblem,
  kind: 'input' | 'output',
  trialNum: number
): Promise<TestcaseResult | null> {
  const data =
    problem.platform === 'njudge'
      ? await loadNjudgeTestcase(problem, kind, trialNum)
      : await loadFirebaseTestcase(problem, kind, trialNum);

  if (data === null) {
    return null;
  }

  const { downloadURL, fileSize } = data;

  if (fileSize > 1024 * 1024) {
    return {
      downloadURL,
      previewText:
        'Warning: Testcase file is over 1MiB!\nPlease download manually.',
    };
  }

  const res = await fetch(downloadURL);
  const text = await res.text();
  if (text.length > 1000) {
    return {
      downloadURL,
      previewText: `Warning: Only showing the first 1000 chars!\n${text.substring(0, 1000)}...`,
    };
  }

  return {
    downloadURL,
    previewText: text,
  };
}
