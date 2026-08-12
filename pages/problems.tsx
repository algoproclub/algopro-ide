import WithTeacherLogin from '../src/components/WithTeacherLogin';
import React, { useEffect, useState } from 'react';
import { getPlatformName } from '../src/scripts/getPlatformName';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
} from 'firebase/firestore';
import {
  type Platform,
  platforms,
  type ProblemTag,
  problemTags,
  type TagProblem,
} from '../src/types/problem';
import Checkbox from '../src/components/Checkbox';
import { useUserContext, type UserRole } from '../src/context/UserContext';
import { get, getDatabase, ref } from 'firebase/database';
import PageTitle from '../src/components/PageTitle';

const firestore = getFirestore();
const database = getDatabase();

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
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'trash' }}
            className="inline w-3.5 h-3.5"
          />
        </button>
      )}
    </div>
  );
};

type Option = { id: string; name: string };

async function getSchools(userRole: UserRole | null): Promise<Option[]> {
  if (userRole?.admin) {
    const schoolsSnap = await getDocs(collection(firestore, 'schools'));
    return schoolsSnap.docs.map(docu => ({
      id: docu.id,
      name: docu.data().name || docu.id,
    }));
  }

  const schoolIDs = userRole?.teacher;

  if (!schoolIDs) {
    return [];
  }

  const results = await Promise.all(
    schoolIDs.map(async id => {
      const snap = await getDoc(doc(firestore, 'schools', id));
      return { id, name: snap.data()?.name || snap.id };
    })
  );

  return results;
}

async function getGroups(schoolID: string): Promise<Option[]> {
  const groupsSnap = await getDocs(
    query(collection(firestore, 'groups'), where('school', '==', schoolID))
  );

  return groupsSnap.docs.map(docu => ({
    id: docu.id,
    name: docu.data().name || docu.id,
  }));
}

type ProblemKey = `${Platform}:${string}`;
type SolvedAggregated = {
  studentCount: number;
  problems: Record<ProblemKey, number>;
};

async function getSolvedCounts(
  schoolId: string,
  groupId: string
): Promise<SolvedAggregated> {
  const schoolStudentsSnap = await getDocs(
    query(
      collection(firestore, 'userdata'),
      where('schools', 'array-contains', schoolId)
    )
  );

  const groupStudentIds = schoolStudentsSnap.docs
    .filter(doc => doc.get('groups')?.includes(groupId) === true)
    .map(doc => doc.id);

  const userSnaps = await Promise.all(
    groupStudentIds.map(id => get(ref(database, `users/${id}`)))
  );

  const solvedCounts: Record<ProblemKey, number> = {};
  for (const snap of userSnaps) {
    const userData = snap.val() ?? {};
    for (const platform of platforms) {
      const solved: Record<string, true> =
        userData[`platform-${platform}`]?.['solved'] ?? {};
      for (const problemId of Object.keys(solved)) {
        const key: ProblemKey = `${platform}:${problemId}`;
        solvedCounts[key] = (solvedCounts[key] ?? 0) + 1;
      }
    }
  }

  return {
    studentCount: groupStudentIds.length,
    problems: solvedCounts,
  };
}

const PageContent = () => {
  const { userRole } = useUserContext();
  const [problemset, setProblemset] = useState<TagProblem[]>([]);
  const [platformFilter, setPlatformFilter] = useState<Record<string, boolean>>(
    Object.fromEntries(platforms.map(label => [label, true]))
  );
  const [problemNameFilter, setProblemNameFilter] = useState<string>('');
  const [tagFilters, setTagFilters] = useState<ProblemTag[]>([]);
  const [tagFilterInput, setTagFilterInput] = useState<string>('');
  const [tagFilterFocus, setTagFilterFocus] = useState(false);

  const [schools, setSchools] = useState<Option[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>();
  const [selectedGroupId, setSelectedGroupId] = useState<string>();

  const [solvedCounts, setSolvedCounts] = useState<SolvedAggregated>({
    studentCount: 0,
    problems: {},
  });

  useEffect(() => {
    getSchools(userRole).then(setSchools);
  }, [userRole]);

  useEffect(() => {
    setSelectedGroupId(undefined);

    if (!selectedSchoolId) {
      setGroups([]);
      return;
    }

    getGroups(selectedSchoolId).then(setGroups);
  }, [selectedSchoolId]);

  useEffect(() => {
    if (!selectedGroupId || !selectedSchoolId) {
      setSolvedCounts({ studentCount: 0, problems: {} });
      return;
    }
    let cancelled = false;
    getSolvedCounts(selectedSchoolId, selectedGroupId).then(result => {
      if (!cancelled) setSolvedCounts(result);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, selectedSchoolId]);

  const togglePlatformFilter = (label: string) => {
    setPlatformFilter(prev => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  useEffect(() => {
    const loadData = async () => {
      const snaps = await Promise.all(
        platforms.map(platform =>
          getDocs(collection(firestore, `problemsets/${platform}/problems`))
        )
      );
      const problems = snaps.flatMap(snap =>
        snap.docs.map(doc => doc.data() as TagProblem)
      );
      setProblemset(problems);
    };
    loadData();
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
      if (tagFilterInputOptions.length > 0) {
        toggleTag(tagFilterInputOptions[0].trim());
        setTagFilterInput('');
      } else {
        alert(`Invalid problem tag "${tagFilterInput}".`);
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
                  autoFocus={true}
                  value={problemNameFilter}
                  onChange={e => setProblemNameFilter(e.target.value)}
                />
              </div>
              <div
                className="m-2"
                onFocus={() => setTagFilterFocus(true)}
                onBlur={() => setTagFilterFocus(false)}
                tabIndex={-1}
              >
                <input
                  type="text"
                  placeholder="Filter tag"
                  className="font-mono bg-gray-900 border-gray-700 h-8 resize-none p-2 rounded text-sm"
                  value={tagFilterInput}
                  onChange={e => setTagFilterInput(e.target.value)}
                  onKeyDown={handleKeyDownTagInput}
                />
                {tagFilterFocus && (
                  <ul className="border border-gray-700 rounded-md bg-gray-900 absolute m-0.5 max-h-[30rem] overflow-auto">
                    {tagFilterInputOptions.length > 0 &&
                      tagFilterInputOptions.map((option, index) => (
                        <li
                          className="px-3 py-2 hover:bg-gray-800 active:bg-gray-700 flex justify-between items-center min-w-[10rem]"
                          key={index}
                          onMouseDown={() => {
                            toggleTag(option);
                            setTagFilterInput('');
                          }}
                        >
                          <span className="mr-3">{option}</span>
                          <FontAwesomeIcon
                            className="inline w-3.5 h-3.5"
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
            <td className="px-3 py-1.5 border-x border-gray-700 w-[22rem]">
              <div className="flex flex-col space-y-3 py-2">
                <div className="flex flex-col">
                  <label className="text-xs text-gray-400 mb-1">School</label>
                  <select
                    aria-label="School"
                    className="bg-gray-900 border border-gray-700 h-8 px-2 pr-8 rounded text-sm"
                    value={selectedSchoolId ?? ''}
                    onChange={e =>
                      setSelectedSchoolId(e.target.value || undefined)
                    }
                  >
                    <option value="">Select school…</option>
                    {schools.map(({ id, name }) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-400 mb-1">Group</label>
                  <select
                    aria-label="Group"
                    className="bg-gray-900 border border-gray-700 h-8 px-2 pr-8 rounded text-sm disabled:opacity-50"
                    value={selectedGroupId ?? ''}
                    onChange={e =>
                      setSelectedGroupId(e.target.value || undefined)
                    }
                    disabled={!selectedSchoolId || groups.length === 0}
                  >
                    <option value="">
                      {selectedSchoolId
                        ? 'Select group…'
                        : 'Select school first'}
                    </option>
                    {groups.map(({ id, name }) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="border border-gray-600 bg-gray-800 overflow-y-auto mt-5">
        <table className="text-sm bg-gray-900 border-collapse w-full">
          <tbody className="divide-y divide-gray-700">
            {problemset
              .filter(({ platform, title, tags }) => {
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
                <tr
                  className="h-[3.5rem]"
                  key={platform && id ? `${platform}:${id}` : index}
                >
                  <td className="py-2 px-3 w-[10.0rem] border-x border-gray-700 bg-gray-800 font-bold">
                    {platform && getPlatformName(platform)} {title}
                  </td>
                  <td className="space-x-1 px-3 py-1.5 w-[30rem] border-x border-gray-700">
                    {tags &&
                      tags.map((tag, index) => (
                        <Tag key={index} tag={tag}></Tag>
                      ))}
                  </td>
                  {selectedGroupId && platform && id && (
                    <td className="px-3 py-1.5 w-[8rem] border-x border-gray-700 text-center">
                      <span className="whitespace-nowrap">
                        Solved:{' '}
                        {solvedCounts.problems[`${platform}:${id}`] ?? 0}/
                        {solvedCounts.studentCount}
                      </span>
                    </td>
                  )}
                  <td className="space-x-1 px-2 py-1.5 w-[1.5rem] border-x border-gray-700 bg-gray-800">
                    {platform && id && (
                      <a
                        title="Edit problem"
                        className="px-2 py-1 rounded-md hover:bg-gray-700 inline-block"
                        href={`/edit/${platform}/${id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FontAwesomeIcon
                          icon={{ prefix: 'fas', iconName: 'edit' }}
                          className="w-3.5 h-3.5 inline"
                        />
                      </a>
                    )}
                    <a
                      title="Open original problem"
                      className="px-2 py-1 rounded-md hover:bg-gray-700 inline-block"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FontAwesomeIcon
                        icon={{ prefix: 'fas', iconName: 'arrow-right' }}
                        className="w-3.5 h-3.5 inline"
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
    <>
      <PageTitle>Problemset</PageTitle>
      <WithTeacherLogin>
        <PageContent />
      </WithTeacherLogin>
    </>
  );
}
