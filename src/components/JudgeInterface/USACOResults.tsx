import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { StatusData, TestCase } from '../../types/problem';

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
      className={`m-1 p-1 inline-block w-[5rem] bg-opacity-40 border-opacity-60 border ${containerClasses} relative rounded-[4px]`}
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

export default function USACOResults({ data }: { data: StatusData }) {
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
        <p className="font-medium text-gray-200 border-gray-700">
          <span className="space-x-2">
            {!['error', 'resolved'].includes(data.statusCode) && (
              <FontAwesomeIcon
                icon={{ prefix: 'fas', iconName: 'gear' }}
                className="mr-2 w-4 h-4 text-gray-400 animate-spin-slow"
              />
            )}
            {data.statusCode === 'error' && (
              <FontAwesomeIcon
                icon={{ prefix: 'fas', iconName: 'exclamation-triangle' }}
                className="mr-2 text-yellow-500 w-4 h-4"
              />
            )}
            {data.statusCode === 'resolved' &&
              data.message?.toLowerCase() === 'correct answer' && (
                <FontAwesomeIcon
                  icon={{ prefix: 'fas', iconName: 'check' }}
                  className="mr-2 text-green-500 w-4 h-4"
                />
              )}
            {data.statusCode === 'resolved' &&
              data.message?.toLowerCase() !== 'correct answer' && (
                <FontAwesomeIcon
                  icon={{ prefix: 'fas', iconName: 'xmark' }}
                  className="mr-2 w-4 h-4 text-red-500"
                />
              )}
            {data.message ? capitalize(data.message) : null}
            {!['error', 'resolved'].includes(data.statusCode) && '...'}
          </span>
          {(data.time || data.memory) && <span> (</span>}
          {data.time && <span>{data.time}</span>}
          {data.time && data.memory && <span>, </span>}
          {data.memory && <span>{data.memory}</span>}
          {(data.time || data.memory) && <span>)</span>}
        </p>
        {data.link && (
          <a
            href={data.link}
            className="text-indigo-300 hover:underline"
            target="_blank"
          >
            {data.link}
          </a>
        )}
      </div>
      {(output || data.testCases) && (
        <div className="border-t -mx-4 border-gray-600 " />
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
