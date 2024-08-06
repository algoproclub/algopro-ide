import Dropdown from '../Dropdown';
import { CodeEditor } from '../editor/CodeEditor';
import React, { useState } from 'react';
import { LanguageSelectorDropdown } from './GenericJudgeInterface';
import Link from 'next/link';
import { ProblemData } from '../../types/problem';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const Solutions = ({
  problem,
  solutions,
}: {
  problem: ProblemData;
  solutions: Record<string, string>;
}) => {
  const [selected, setSelected] = useState(0);
  const languages = Object.keys(solutions);
  return (
    <>
      {problem.platform === 'planets' && (
        <div className="border-b border-[#363636] -mx-4 px-4 pb-4 mb-4">
          <Link
            href={`https://planets.algopro.hu/map#${problem.topicID}`}
            target="_blank"
          >
            <button className="inline-flex items-center px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 active:bg-indigo-700 rounded-md text-sm font-medium w-40">
              <FontAwesomeIcon
                className="mr-2 h-4 w-4"
                aria-hidden="true"
                icon={{ iconName: 'arrow-left', prefix: 'fas' }}
              />
              <span className="text-center flex-1">View topic</span>
            </button>
          </Link>
        </div>
      )}
      <div className="flex items-end space-x-3">
        <Dropdown
          items={languages}
          label="Language"
          selected={selected}
          setSelected={(k: number) => setSelected(k)}
        />
        <Link href="#" target="_blank">
          <button className="px-4 py-2.5 bg-indigo-900 hover:bg-indigo-800 active:bg-indigo-700 rounded-md text-sm font-medium w-20">
            Visit
          </button>
        </Link>
      </div>
      <div className="h-full mt-4 -mx-4 border-y border-gray-700">
        <CodeEditor
          value={solutions[languages[selected]]}
          language={languages[selected]}
          options={{
            readOnly: true,
            wordWrap: 'on',
            automaticLayout: true,
            minimap: { enabled: false },
          }}
        />
      </div>
    </>
  );
};

export default Solutions;
