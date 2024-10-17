import WithTeacherLogin from '../src/components/WithTeacherLogin';
import React, { useEffect, useState } from 'react';
import { getPlatformName } from '../src/scripts/getPlatformName';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { collection, getDocs, getFirestore, query } from 'firebase/firestore';
import {
  platforms,
  ProblemTag,
  problemTags,
  TagProblem,
} from '../src/types/problem';
import Checkbox from '../src/components/Checkbox';

const firestore = getFirestore();

const Tag = ({
  tag,
  tagToggle,
}: {
  tag: ProblemTag;
  tagToggle?: (arg0: ProblemTag) => void;
}) => {
  return (
    <div className="rounded-md border border-gray-600 bg-gray-900 px-2 py-1 m-1 whitespace-nowrap inline-block">
      {tag}
      {tagToggle && (
        <button
          className="px-2 py-1 rounded-md hover:bg-gray-700"
          onClick={() => tagToggle(tag)}
        >
          <FontAwesomeIcon icon={{ prefix: 'fas', iconName: 'trash' }} />
        </button>
      )}
    </div>
  );
};

const PageContent = () => {
  const [problemset, setProblemset] = useState<TagProblem[]>([]);
  const [platformFilter, setPlatformFilter] = useState<Record<string, boolean>>(
    Object.fromEntries(platforms.map(label => [label, true]))
  );
  const [problemNameFilter, setProblemNameFilter] = useState<string>('');
  const [tagFilters, setTagFilters] = useState<ProblemTag[]>([]);
  const [tagFilterInput, setTagFilterInput] = useState<string>('');

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

  const tagFilterInputOptions = problemTags.filter(option =>
    option.toLowerCase().includes(tagFilterInput.toLowerCase())
  );

  const toggleTag = (tag: ProblemTag) => {
    if (tagFilters.includes(tag)) {
      setTagFilters(prevTags => prevTags.filter((label, _) => label != tag));
    } else {
      setTagFilters([...tagFilters, tag]);
    }
  };

  const handleKeyDownTagInput = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Enter') {
      if (tagFilterInput.trim() !== '' && tagFilterInputOptions.length > 0) {
        toggleTag(tagFilterInputOptions[0].trim());
        setTagFilterInput('');
      } else {
        alert(`Invalid problem tag \"${tagFilterInput}\".`);
      }
    }
  };

  return (
    <div className="space-y-2 m-10 mx-20">
      <table className="bg-gray-900 px-3 py-2 border border-gray-600 text-sm space-x-2 w-full">
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
            <td className="px-3 py-1.5 border-x border-gray-700 w-[10rem]">
              <div className="m-2">
                <input
                  type="text"
                  placeholder="Search problem name"
                  className="font-mono bg-gray-900 border-gray-700 h-8 resize-none p-2 rounded text-sm"
                  value={problemNameFilter}
                  onChange={e => setProblemNameFilter(e.target.value)}
                />
              </div>
              <div className="m-2">
                <input
                  type="text"
                  placeholder="Filter new tag"
                  className="font-mono bg-gray-900 border-gray-700 h-8 resize-none p-2 rounded text-sm"
                  value={tagFilterInput}
                  onChange={e => setTagFilterInput(e.target.value)}
                  onKeyDown={handleKeyDownTagInput}
                />
                {tagFilterInput.trim() && (
                  <ul className="border border-gray-700 rounded-md bg-gray-900 absolute m-0.5">
                    {tagFilterInputOptions.length > 0 &&
                      tagFilterInputOptions.map((option, index) => (
                        <li
                          className="px-3 py-2 hover:bg-gray-800 active:bg-gray-700 flex justify-between items-center min-w-[10rem]"
                          key={index}
                          onClick={() => {
                            toggleTag(option);
                            setTagFilterInput('');
                          }}
                        >
                          <span className="mr-3">{option}</span>
                          <FontAwesomeIcon
                            icon={{
                              prefix: 'fas',
                              iconName: tagFilters.includes(option)
                                ? 'trash'
                                : 'plus',
                            }}
                          />
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </td>
            <td className="py-1 px-3 border-x border-gray-700">
              {tagFilters.map((item, index) => (
                <Tag tag={item} key={index} tagToggle={toggleTag} />
              ))}
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
                    (title
                      .toLowerCase()
                      .includes(problemNameFilter.toLowerCase()) &&
                      (tagFilters.length === 0 ||
                        (tags &&
                          tagFilters.every(filterTag =>
                            tags.includes(filterTag)
                          )))))
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
                        <Tag key={index} tag={tag}></Tag>
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
