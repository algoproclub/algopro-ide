import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { StatusData, TestCase } from '../../types/problem';
import TimeAgoLabel from '../TimeStamp';

const capitalize = (text: string): string => {
  return text[0].toUpperCase() + text.substring(1);
};

const USACOTestCase = ({ data }: { data: TestCase }) => {
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
      className={`m-1 p-1 inline-block w-[5.5rem] bg-opacity-25 border-opacity-50 border ${containerClasses} relative rounded-[4px]`}
      title={capitalize(data.title)}
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
          >
            {data.link}
          </a>
        )}
      </div>
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
              <USACOTestCase data={tc} key={tc.trialNum} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
