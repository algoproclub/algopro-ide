import React, { Fragment, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  PlatformProblem,
  ProblemData,
  StatusData,
  TestCase,
} from '../../types/problem';
import TimeAgoLabel from '../TimeStamp';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEditorContext } from '../../context/EditorContext';
import {
  getStorage,
  ref as storageRef,
  getDownloadURL,
  getMetadata,
  StorageReference,
} from 'firebase/storage';
import classNames from 'classnames';
import { PreBox } from './Samples';

const capitalize = (text: string): string => {
  return text[0].toUpperCase() + text.substring(1);
};

function makeTestcaseStorageRef(
  problem: ProblemData | PlatformProblem,
  kind: 'input' | 'output',
  trialNum: number
) {
  const { platform, id } = problem;
  const path = `testcases/${platform}/${id}/${kind}${trialNum - 1}.txt`;
  const storage = getStorage();
  const ref = storageRef(storage, path);
  return ref;
}

async function downloadFileFromURLWithName(url: string, fileName: string) {
  const res = await fetch(url);
  const blob = await res.blob();

  // firebase doesn't allow specifying a custom filename if we use the download URL directly
  // so we create a blob-based URL instead
  const blobUrl = window.URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  anchor.click();

  window.URL.revokeObjectURL(blobUrl);
}

async function downloadFileAndCopyToClipboard(url: string) {
  const res = await fetch(url);
  const text = await res.text();

  await navigator.clipboard.writeText(text);
}

// copied from UserSettingsModal
const TestCaseInfoModal = ({
  isOpen,
  onClose,
  testCase,
}: {
  isOpen: boolean;
  onClose: () => void;
  testCase: TestCase;
}) => {
  const { fileData } = useEditorContext();
  const problem = fileData.problem;

  const [inputDownloadURL, setInputDownloadURL] = useState<string | null>(null);
  const [outputDownloadURL, setOutputDownloadURL] = useState<string | null>(
    null
  );
  const [inputPreviewText, setInputPreviewText] = useState<string>('');
  const [outputPreviewText, setOutputPreviewText] = useState<string>('');

  useEffect(() => {
    setInputDownloadURL(null);
    setOutputDownloadURL(null);
    setInputPreviewText('');
    setOutputPreviewText('');

    if (problem === null) return;

    const inputRef = makeTestcaseStorageRef(
      problem,
      'input',
      testCase.trialNum
    );
    const outputRef = makeTestcaseStorageRef(
      problem,
      'output',
      testCase.trialNum
    );

    async function startTestcaseSetup(
      ref: StorageReference,
      setDownloadURL: (url: string) => void,
      setPreviewText: (text: string) => void
    ) {
      try {
        const meta = await getMetadata(ref);
        const url = await getDownloadURL(ref);
        setDownloadURL(url);
        const sizeInBytes = meta.size;
        const sizeInMiBs = sizeInBytes / 1024 / 1024;
        if (sizeInMiBs > 1) {
          setPreviewText(
            'Warning: Testcase file is over 1MiB!\nPlease download manually.'
          );
          return;
        }
        const res = await fetch(url);
        const text = await res.text();
        if (text.length > 1000) {
          const trimmedText = text.substring(0, 1000);
          setPreviewText(
            `Warning: Only showing the first 1000 chars!\n${trimmedText}...`
          );
        } else {
          setPreviewText(text);
        }
      } catch (e) {
        console.error(e);
      }
    }

    // we don't await so that they can run parallelly
    startTestcaseSetup(inputRef, setInputDownloadURL, setInputPreviewText);
    startTestcaseSetup(outputRef, setOutputDownloadURL, setOutputPreviewText);
  }, [testCase, problem]);

  const closeWithoutSaving = () => {
    onClose();
  };

  if (problem === null) {
    return <></>;
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        static
        className="fixed z-10 inset-0 overflow-y-auto"
        open={isOpen}
        onClose={closeWithoutSaving}
      >
        <div className="flex items-end justify-center min-h-full pt-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="inline-block bg-gray-800 md:rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl w-full">
              <div className="px-4 sm:px-6 pt-4 pb-2">
                <Dialog.Title
                  as="h3"
                  className="text-lg leading-6 font-medium text-center"
                >
                  Testcase Info
                </Dialog.Title>
              </div>
              <div className="p-4 sm:p-6 space-y-3">
                <div className="flex flex-row gap-8 max-h-96">
                  <div className="flex flex-col items-start gap-4 whitespace-nowrap">
                    <USACOTestCase data={testCase} />
                    <div className="flex flex-col gap-2">
                      <button
                        className={classNames(
                          'inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none',
                          inputDownloadURL === null
                            ? 'bg-gray-700'
                            : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500'
                        )}
                        disabled={inputDownloadURL === null}
                        onClick={() => {
                          if (inputDownloadURL === null) return;
                          downloadFileFromURLWithName(
                            inputDownloadURL,
                            `${problem.platform}_${problem.id}_input${testCase.trialNum}.txt`
                          );
                        }}
                      >
                        {inputDownloadURL === null
                          ? 'Input unavailable'
                          : 'Download input'}
                      </button>
                      <button
                        className={classNames(
                          'inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none',
                          outputDownloadURL === null
                            ? 'bg-gray-700'
                            : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500'
                        )}
                        disabled={outputDownloadURL === null}
                        onClick={() => {
                          if (outputDownloadURL === null) return;
                          downloadFileFromURLWithName(
                            outputDownloadURL,
                            `${problem.platform}_${problem.id}_output${testCase.trialNum}.txt`
                          );
                        }}
                      >
                        {outputDownloadURL === null
                          ? 'Output unavailable'
                          : 'Download output'}
                      </button>
                      <button
                        className={classNames(
                          'inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none',
                          inputDownloadURL === null
                            ? 'bg-gray-700'
                            : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500'
                        )}
                        disabled={inputDownloadURL === null}
                        onClick={() => {
                          if (inputDownloadURL === null) return;
                          downloadFileAndCopyToClipboard(inputDownloadURL);
                        }}
                      >
                        {inputDownloadURL === null
                          ? 'Input unavailable'
                          : 'Copy input to clipboard'}
                      </button>
                      <button
                        className={classNames(
                          'inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none',
                          outputDownloadURL === null
                            ? 'bg-gray-700'
                            : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500'
                        )}
                        disabled={outputDownloadURL === null}
                        onClick={() => {
                          if (outputDownloadURL === null) return;
                          downloadFileAndCopyToClipboard(outputDownloadURL);
                        }}
                      >
                        {outputDownloadURL === null
                          ? 'Output unavailable'
                          : 'Copy output to clipboard'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grow grid-rows-2 place-items-stretch gap-4">
                    <PreBox title="Input Preview" text={inputPreviewText} />
                    <PreBox title="Output Preview" text={outputPreviewText} />
                  </div>
                </div>
              </div>
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="rounded-md text-gray-200 hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onClick={closeWithoutSaving}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

const USACOTestCase = ({
  data,
  onClick,
}: {
  data: TestCase;
  onClick?: () => void;
}) => {
  const containerClasses =
    data.title?.toLowerCase() === 'correct answer'
      ? 'bg-green-700 border-green-700'
      : data.title === 'Did not run'
        ? 'bg-gray-700 border-gray-700'
        : 'bg-red-700 border-red-700';
  const textColor =
    data.title?.toLowerCase() === 'correct answer'
      ? 'text-green-100'
      : 'text-red-100';
  return (
    <div
      className={classNames(
        `m-1 p-1 inline-block w-[5.5rem] bg-opacity-25 border-opacity-50 border relative rounded-[4px]`,
        containerClasses,
        onClick ? 'hover:cursor-pointer' : ''
      )}
      title={capitalize(data.title)}
      onClick={onClick ?? (() => {})}
    >
      <div className={`font-semibold text-center ${textColor} pt-1`}>
        {data.symbol === '✓' && (
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'check' }}
            className="w-6 h-6"
          />
        )}
        {data.symbol === 'x' && (
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'xmark' }}
            className="w-6 h-6"
          />
        )}
      </div>
      <div>
        <div className="flex justify-end">
          {data.memory && (
            <span className={`text-[0.625rem]`}>{data.memory}</span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className={`${textColor} text-[0.8125rem] font-bold leading-3`}>
            {data.trialNum}
          </span>
          <span className={`text-[0.625rem] leading-3`}>{data.time}</span>
        </div>
      </div>
    </div>
  );
};

export default function USACOResults({
  data,
  submissionTime,
  startTime,
}: {
  data: StatusData;
  submissionTime?: number;
  startTime?: number;
}) {
  let equalUpToTrim = false;
  let output = data.output;

  if (data.message?.includes('Incorrect') && output) {
    const lines = output.split('\n');
    const indices = [],
      answers = [];
    for (let i = 0; i < lines.length; ++i) {
      if (lines[i].endsWith(':') && (i == 0 || lines[i - 1] === '')) {
        indices.push(i);
      }
    }
    indices.push(lines.length);
    for (let i = 0; i + 1 < indices.length; ++i) {
      if (
        indices[i] + 3 == indices[i + 1] &&
        lines[indices[i] + 1] === '[File missing!]'
      ) {
        continue;
      }
      let ans = '';
      for (let j = indices[i] + 1; j < indices[i + 1] - 1; ++j) {
        ans += lines[j].trim() + '\n';
        lines[j] = lines[j].replace(/ /g, '\u2423'); // make spaces visible
      }
      answers.push(ans);
    }
    equalUpToTrim = answers[0].trim() === answers[1]?.trim();
    if (equalUpToTrim) {
      // display whitespace
      output = lines.join('\n');
    }
  }

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(
    null
  );

  return (
    <div className="mt-3">
      <div className="pb-3">
        <div className="flex items-start font-medium text-gray-200 border-gray-700 space-x-2">
          <span>
            {!['error', 'resolved'].includes(data.statusCode) && (
              <FontAwesomeIcon
                icon={{ prefix: 'fas', iconName: 'gear' }}
                className="w-3.5 h-3.5 text-gray-400 animate-spin-slow"
              />
            )}
            {data.statusCode === 'error' && (
              <FontAwesomeIcon
                icon={{ prefix: 'fas', iconName: 'exclamation-triangle' }}
                className="text-yellow-500 w-3.5 h-3.5"
              />
            )}
            {data.statusCode === 'resolved' &&
              data.message?.toLowerCase() === 'correct answer' && (
                <FontAwesomeIcon
                  icon={{ prefix: 'fas', iconName: 'check' }}
                  className="text-green-500 w-3.5 h-3.5"
                />
              )}
            {data.statusCode === 'resolved' &&
              data.message?.toLowerCase() !== 'correct answer' &&
              data.message?.toLowerCase()?.includes('partially') && (
                <FontAwesomeIcon
                  icon={{ prefix: 'fas', iconName: 'check' }}
                  className="text-yellow-500 w-3.5 h-3.5"
                />
              )}
            {data.statusCode === 'resolved' &&
              data.message?.toLowerCase() !== 'correct answer' &&
              !data.message?.toLowerCase()?.includes('partially') && (
                <FontAwesomeIcon
                  icon={{ prefix: 'fas', iconName: 'xmark' }}
                  className="w-3.5 h-3.5 text-red-500"
                />
              )}
          </span>
          <span className="break-words overflow-hidden text-[0.92rem] leading-[1.5rem]">
            <span className="font-semibold">
              {data.message ? capitalize(data.message) : null}
              {!['error', 'resolved'].includes(data.statusCode) && '...'}
            </span>
            {(data.time || data.memory) && ' ('}
            {data.time && '' + data.time}
            {data.time && data.memory && ', '}
            {data.memory && '' + data.memory}
            {(data.time || data.memory) && ')'}
          </span>
        </div>
        {submissionTime && (
          <div className="text-sm text-gray-300">
            {startTime ? (
              <span>
                Time:{' '}
                <span
                  className="underline underline-offset-2 decoration-dotted"
                  title={new Date(submissionTime).toLocaleString('en')}
                >
                  {Math.floor((submissionTime - startTime) / 60000)}:
                  {Math.floor(((submissionTime - startTime) / 1000) % 60)
                    .toString()
                    .padStart(2, '0')}
                </span>
              </span>
            ) : (
              <TimeAgoLabel date={new Date(submissionTime)} />
            )}
          </div>
        )}
        {data.link && (
          <a
            href={data.link}
            className="text-indigo-300 hover:underline break-all"
            target="_blank"
            rel="noreferrer"
          >
            {data.link}
          </a>
        )}
      </div>

      {selectedTestCase && (
        <TestCaseInfoModal
          testCase={selectedTestCase}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {(output || data.testCases) && (
        <div className="border-t -mx-4 border-gray-700 " />
      )}
      {output && (
        <div className="pt-3">
          <pre className="font-mono text-gray-300 leading-tight mt-2 text-sm bg-gray-900 rounded p-3 border border-gray-700 overflow-auto">
            {output}
          </pre>
          {equalUpToTrim && (
            <p className="font-bold text-gray-200 mt-3">
              Your output contains extra whitespace. This is an error; see{' '}
              <a
                href="https://usaco.guide/general/io?lang=cpp#usaco-note---extra-whitespace"
                className="text-indigo-300"
              >
                here
              </a>{' '}
              for details.
            </p>
          )}
        </div>
      )}
      {data.testCases && (
        <>
          <div className="my-3 -mx-1">
            {data.testCases.map(tc => (
              <USACOTestCase
                key={tc.trialNum}
                data={tc}
                onClick={() => {
                  setSelectedTestCase(tc);
                  setIsModalOpen(true);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
