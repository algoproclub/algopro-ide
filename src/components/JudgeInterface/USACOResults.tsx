import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// eslint-disable-next-line @typescript-eslint/no-explicit-any

const capitalize = (text: string): string => {
  return text[0].toUpperCase() + text.substring(1);
};
const USACOTestCase = ({ data }: { data: any }) => {
  const containerClasses =
    data.title.toLowerCase() === 'correct answer'
      ? 'bg-green-700 border-green-700'
      : data.title === 'Did not run'
      ? 'bg-gray-700 border-gray-700'
      : 'bg-red-700 border-red-700';
  const textColor =
    data.title.toLowerCase() === 'correct answer'
      ? 'text-green-100'
      : 'text-red-100';
  return (
    <div
      className={`m-1 inline-block w-[76px] h-[60px] bg-opacity-50 border ${containerClasses} relative rounded`}
      title={capitalize(data.title)}
    >
      <div
        className={`font-semibold text-center ${textColor} leading-[2.75rem]`}
      >
        {data.symbol === '✓' && (
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'check' }}
            className="w-5 h-5"
          />
        )}
        {data.symbol === 'x' && (
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'xmark' }}
            className="w-5 h-5"
          />
        )}
      </div>
      <span
        className={`absolute bottom-0 left-[4px] ${textColor} text-[0.8125rem] font-bold`}
      >
        {data.trialNum}
      </span>
      <span
        className={`absolute bottom-0 right-0 text-right ${textColor} leading-3 p-1 text-[0.625rem]`}
      >
        {data.memory}
        <br />
        {data.time}
      </span>
    </div>
  );
};

export default function USACOResults({
  data,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}): JSX.Element | null {
  if (!data) return null;
  let equalUpToTrim = false;
  let output = data.output;
  if (data.message.includes('Incorrect') && output) {
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
      )
        continue;
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
        <p className="font-bold text-gray-200 border-gray-700">
          <span className="space-x-2">
            <span
              className={`${
                data.message.toLowerCase() === 'correct answer'
                  ? 'text-green-500'
                  : 'text-red-500'
              }`}
            >
              {data.statusCode === 0 &&
                data.message.toLowerCase() === 'correct answer' && (
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'check' }}
                    className="mr-2 w-4 h-4"
                  />
                )}
              {data.statusCode === 0 &&
                data.message.toLowerCase() !== 'correct answer' && (
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'xmark' }}
                    className="mr-2 w-4 h-4"
                  />
                )}
            </span>
            {capitalize(data.message)}
            {data.statusCode === -8 && '...'}
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
        {output && (
          <>
            <pre className="font-mono text-red-300 leading-tight mt-2 text-sm">
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
          </>
        )}
      </div>
      {data.testCases && (
        <>
          <div className="border-t -mx-4 border-gray-600 " />
          <div className="mt-1 pt-3 -mx-1">
            {data.testCases.map((tc: any) => (
              <USACOTestCase data={tc} key={tc.trialNum} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
