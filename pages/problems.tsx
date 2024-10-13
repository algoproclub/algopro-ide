import WithTeacherLogin from '../src/components/WithTeacherLogin';
import React, { useEffect, useState } from 'react';
import { getPlatformName } from '../src/scripts/getPlatformName';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { collection, getDocs, getFirestore, query } from 'firebase/firestore';
import { platforms, TagProblem } from '../src/types/problem';
import Checkbox from '../src/components/Checkbox';

const firestore = getFirestore();

const PageContent = () => {
  const [problemset, setProblemset] = useState<TagProblem[]>([]);
  const [platformFilter, setPlatformFilter] = useState<Record<string, boolean>>(
    Object.fromEntries(platforms.map(label => [label, true]))
  );
  const [problemNameFilter, setProblemNameFilter] = useState<string>('');

  const togglePlatformFilter = (label: string) => {
    setPlatformFilter(prev => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  useEffect(() => {
    const loadData = async () => {
      const problems: TagProblem[] = [];

      for (const platform of platforms) {
        const results = await getDocs(
          query(collection(firestore, `problemsets/${platform}/problems`))
        );
        results.forEach(doc => {
          const problem = doc.data() as TagProblem;
          problems.push(problem);
        });
      }

      setProblemset(problems);
    };
    loadData().then(() => {
      console.log('done');
    });
  }, []);

  return (
    <div className="space-y-2 m-10 mx-20">
      <table className="bg-gray-900 px-3 py-2 border border-gray-600 text-sm space-x-2">
        <tbody>
          <tr>
            <td className="px-3 py-1.5 w-[20rem] border-x border-gray-700">
              {platforms.map(platform => (
                <div
                  className="inline-block mx-3 my-2"
                  key={platform.toString()}
                >
                  <Checkbox
                    checked={platformFilter[platform.toString()]}
                    label={platform.toString()}
                    toggleChecked={() =>
                      togglePlatformFilter(platform.toString())
                    }
                  />
                </div>
              ))}
            </td>
            <td className="px-3 py-1.5 border-x border-gray-700">
              <input
                type="text"
                placeholder="Search problem name"
                className="font-mono bg-gray-900 border-gray-700 h-8 resize-none p-2 rounded text-sm"
                value={problemNameFilter}
                onChange={e => setProblemNameFilter(e.target.value)}
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div className="border border-gray-600 bg-gray-800 overflow-y-auto mt-5">
        <table className="text-sm bg-gray-900 border-collapse w-full">
          <tbody className="divide-y divide-gray-700">
            {problemset
              .filter(({ platform, id, url, title, tags }) => {
                return (
                  (!platform || platformFilter[platform.toString()]) &&
                  (!title ||
                    title
                      .toLowerCase()
                      .includes(problemNameFilter.toLowerCase()))
                );
              })
              .map(({ platform, id, url, title, tags }, index) => (
                <tr className="h-[3.5rem]" key={index}>
                  <td className="py-2 px-3 w-[10.0rem] border-x border-gray-700 bg-gray-800 font-bold">
                    {platform && getPlatformName(platform)} {title}
                  </td>
                  <td className="space-x-1 px-3 py-1.5 w-[30rem] border-x border-gray-700">
                    {tags &&
                      tags.map((tag, index) => (
                        <div
                          className="rounded-md border border-gray-600 bg-gray-900 px-2 py-1 m-1 whitespace-nowrap inline-block"
                          key={index}
                        >
                          {tag}
                        </div>
                      ))}
                  </td>
                  <td className="space-x-1 px-2 py-1.5 w-[1.5rem] border-x border-gray-700 bg-gray-800">
                    {platform && id && (
                      <a
                        title="Edit problem"
                        className="px-2 py-1 rounded-md hover:bg-gray-700"
                        href={`/edit/${platform}/${id}`}
                        target="_blank"
                      >
                        <FontAwesomeIcon
                          icon={{ prefix: 'fas', iconName: 'edit' }}
                          className="w-3.5 h-3.5"
                        />
                      </a>
                    )}
                    <a
                      title="Open original problem"
                      className="px-2 py-1 rounded-md hover:bg-gray-700"
                      href={url}
                      target="_blank"
                    >
                      <FontAwesomeIcon
                        icon={{ prefix: 'fas', iconName: 'arrow-right' }}
                        className="w-3.5 h-3.5"
                      />
                    </a>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function ProblemsetPage() {
  return (
    <WithTeacherLogin>
      <PageContent />
    </WithTeacherLogin>
  );
}
