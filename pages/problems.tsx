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

const firestore = getFirestore();
const database = getDatabase();

const cellBorderClass = 'border-x border-[color:var(--border-muted)]';
const iconButtonClass =
  'px-2 py-1 rounded-md hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)]';
const inputClass =
  'font-mono theme-input border h-8 resize-none p-2 rounded text-sm';
const selectClass =
  'theme-input border h-8 px-2 pr-8 rounded text-sm disabled:opacity-50';

const Tag = ({
  tag,
  tagToggle,
}: {
  tag: ProblemTag;
  tagToggle?: (arg0: ProblemTag) => void;
}) => {
  return (
    <div className="rounded-md border theme-border theme-surface px-2 py-1 m-1 whitespace-nowrap inline-block">
      {tag}
      {tagToggle && (
        <button className={iconButtonClass} onClick={() => tagToggle(tag)}>
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

type UserProblemMap = Record<Platform, Record<string, string>>;

async function getUserProblemMap(id: string): Promise<UserProblemMap> {
  return Object.fromEntries(
    await Promise.all(
      platforms.map(platform =>
        get(
          ref(
            database,
            `users/${id}/platform-${platform}/problem-id-to-file-id`
          )
        ).then(u => [platform, u.val() ?? {}])
      )
    )
  );
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

  const userProblemMaps: Record<string, UserProblemMap> = Object.fromEntries(
    await Promise.all(
      groupStudentIds.map(id => getUserProblemMap(id).then(u => [id, u]))
    )
  );

  const solvedCounts: Record<ProblemKey, number> = {};

  for (const userProblemMap of Object.values(userProblemMaps)) {
    for (const platform of platforms) {
      const problemIdToFileId = userProblemMap[platform];

      const solvedResults = await Promise.all(
        Object.entries(problemIdToFileId).map(([problemId, fileId]) =>
          get(ref(database, `files/${fileId}/solvedStatus/solved`)).then(
            snap => ({ problemId, solved: !!snap.val() })
          )
        )
      );

      for (const { problemId, solved } of solvedResults) {
        if (solved) {
          solvedCounts[`${platform}:${problemId}`] =
            (solvedCounts[`${platform}:${problemId}`] ?? 0) + 1;
        }
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
    if (selectedGroupId && selectedSchoolId) {
      getSolvedCounts(selectedSchoolId, selectedGroupId).then(setSolvedCounts);
    }
  }, [selectedGroupId, selectedSchoolId]);

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
      <table className="theme-table px-3 py-2 border theme-border text-sm space-x-2 w-full">
        <tbody>
          <tr>
            <td className={`px-3 py-1.5 w-[20rem] ${cellBorderClass}`}>
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
            <td className={`px-3 py-1.5 ${cellBorderClass} w-[10rem]`}>
              <div className="m-2">
                <input
                  type="text"
                  placeholder="Search problem name"
                  className={inputClass}
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
                  className={inputClass}
                  value={tagFilterInput}
                  onChange={e => setTagFilterInput(e.target.value)}
                  onKeyDown={handleKeyDownTagInput}
                />
                {tagFilterFocus && (
                  <ul className="border theme-border rounded-md theme-surface absolute m-0.5 max-h-[30rem] overflow-auto">
                    {tagFilterInputOptions.length > 0 &&
                      tagFilterInputOptions.map((option, index) => (
                        <li
                          className="px-3 py-2 hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)] flex justify-between items-center min-w-[10rem]"
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
            <td className={`py-1 px-3 ${cellBorderClass}`}>
              {tagFilters.map((item, index) => (
                <Tag tag={item} key={index} tagToggle={toggleTag} />
              ))}
            </td>
            <td className={`px-3 py-1.5 ${cellBorderClass} w-[22rem]`}>
              <div className="flex flex-col space-y-3 py-2">
                <div className="flex flex-col">
                  <label className="text-xs theme-text-muted mb-1">
                    School
                  </label>
                  <select
                    aria-label="School"
                    className={selectClass}
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
                  <label className="text-xs theme-text-muted mb-1">Group</label>
                  <select
                    aria-label="Group"
                    className={selectClass}
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
      <div className="border theme-border theme-surface-raised overflow-y-auto mt-5">
        <table className="text-sm theme-table border-collapse w-full">
          <tbody className="divide-y divide-[color:var(--border-muted)]">
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
                  <td
                    className={`py-2 px-3 w-[10.0rem] ${cellBorderClass} theme-table-header font-bold`}
                  >
                    {platform && getPlatformName(platform)} {title}
                  </td>
                  <td
                    className={`space-x-1 px-3 py-1.5 w-[30rem] ${cellBorderClass}`}
                  >
                    {tags &&
                      tags.map((tag, index) => (
                        <Tag key={index} tag={tag}></Tag>
                      ))}
                  </td>
                  {selectedGroupId && platform && id && (
                    <td
                      className={`px-3 py-1.5 w-[8rem] ${cellBorderClass} text-center`}
                    >
                      <span className="whitespace-nowrap">
                        Solved:{' '}
                        {solvedCounts.problems[`${platform}:${id}`] ?? 0}/
                        {solvedCounts.studentCount}
                      </span>
                    </td>
                  )}
                  <td
                    className={`space-x-1 px-2 py-1.5 w-[1.5rem] ${cellBorderClass} theme-table-header`}
                  >
                    {platform && id && (
                      <a
                        title="Edit problem"
                        className={`${iconButtonClass} inline-block`}
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
                      className={`${iconButtonClass} inline-block`}
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
    <WithTeacherLogin>
      <PageContent />
    </WithTeacherLogin>
  );
}
