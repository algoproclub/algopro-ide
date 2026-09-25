import WithTeacherLogin from '../src/components/WithTeacherLogin';
import React, { Suspense, useEffect, useState } from 'react';
import { getPlatformName } from '../src/scripts/getPlatformName';
import {
  ArrowTopRightOnSquareIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/20/solid';
import { platforms, type ProblemTag, problemTags } from '../src/types/problem';
import Checkbox from '../src/components/Checkbox';
import { useUserContext } from '../src/context/UserContext';
import PageTitle from '../src/components/PageTitle';
import Dropdown from '../src/components/Dropdown';
import {
  useManagedSchools,
  useSchoolGroups,
} from '../src/hooks/useClassroomMetadata';
import {
  fetchGroupSolvedCounts,
  type GroupSolvedCounts,
} from '../src/data/taskStatus';
import { useAtomValue } from 'jotai';
import { problemLibraryAtom } from '../src/atoms/problemLibrary';
import ProblemLibraryRefreshButton from '../src/components/ProblemLibraryRefreshButton';
import { Button } from '../src/components/Button';

const cellBorderClass = 'border-x border-[color:var(--border-muted)]';
const iconButtonClass =
  'px-2 py-1 rounded-md hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)]';
const inputClass =
  'font-mono theme-input border h-8 resize-none p-2 rounded text-sm';

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
        <Button
          variant="ghost"
          size="sm"
          icon={TrashIcon}
          aria-label={`Remove ${tag} filter`}
          onClick={() => tagToggle(tag)}
        />
      )}
    </div>
  );
};

const PageContent = () => {
  const { userRole } = useUserContext();
  const problemset = useAtomValue(problemLibraryAtom);
  const [platformFilter, setPlatformFilter] = useState<Record<string, boolean>>(
    Object.fromEntries(platforms.map(label => [label, true]))
  );
  const [problemNameFilter, setProblemNameFilter] = useState<string>('');
  const [tagFilters, setTagFilters] = useState<ProblemTag[]>([]);
  const [tagFilterInput, setTagFilterInput] = useState<string>('');
  const [tagFilterFocus, setTagFilterFocus] = useState(false);

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>();
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const schoolsResource = useManagedSchools(userRole);
  const schools = schoolsResource.data;
  const schoolID = schools.some(school => school.id === selectedSchoolId)
    ? selectedSchoolId
    : undefined;
  const groupsResource = useSchoolGroups(schoolID ?? null);
  const groups = groupsResource.data;
  const groupID = groups.some(group => group.id === selectedGroupId)
    ? selectedGroupId
    : undefined;
  const [solvedResource, setSolvedResource] = useState<{
    groupID: string;
    status: 'loading' | 'ready' | 'error';
    data: GroupSolvedCounts;
  } | null>(null);
  const solvedCounts =
    groupID && solvedResource?.groupID === groupID
      ? solvedResource.data
      : { studentCount: 0, problems: {} };
  const solvedStatus =
    groupID && solvedResource?.groupID === groupID
      ? solvedResource.status
      : 'loading';

  useEffect(() => {
    if (!groupID) return;
    let cancelled = false;
    fetchGroupSolvedCounts(groupID).then(
      data => {
        if (!cancelled) setSolvedResource({ groupID, status: 'ready', data });
      },
      () => {
        if (!cancelled)
          setSolvedResource({
            groupID,
            status: 'error',
            data: { studentCount: 0, problems: {} },
          });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [groupID]);

  const togglePlatformFilter = (label: string) => {
    setPlatformFilter(prev => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

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
    <div className="m-10 mx-20 space-y-2">
      <div className="flex justify-end">
        <ProblemLibraryRefreshButton />
      </div>
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
                          {tagFilters.includes(option) ? (
                            <TrashIcon className="inline h-4 w-4" />
                          ) : (
                            <PlusIcon className="inline h-4 w-4" />
                          )}
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
                  <Dropdown
                    items={schools.map(({ id, name }) => ({
                      label: name,
                      value: id,
                    }))}
                    selected={schoolID ?? null}
                    setSelected={value => {
                      setSelectedSchoolId(value);
                      setSelectedGroupId(undefined);
                    }}
                    label="School"
                    placeholder="Select school…"
                    disabled={schoolsResource.status === 'loading'}
                    disabledPlaceholder="Loading schools…"
                    onClear={() => {
                      setSelectedSchoolId(undefined);
                      setSelectedGroupId(undefined);
                    }}
                  />
                </div>
                <div className="flex flex-col">
                  <Dropdown
                    items={groups.map(({ id, name }) => ({
                      label: name,
                      value: id,
                    }))}
                    selected={groupID ?? null}
                    setSelected={setSelectedGroupId}
                    label="Group"
                    placeholder="Select group…"
                    disabledPlaceholder={
                      groupsResource.status === 'loading'
                        ? 'Loading groups…'
                        : 'Select school first'
                    }
                    disabled={!schoolID || groupsResource.status === 'loading'}
                    onClear={() => setSelectedGroupId(undefined)}
                  />
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      {(schoolsResource.status === 'error' ||
        groupsResource.status === 'error') && (
        <p className="text-sm text-[color:var(--danger)]">
          Schools or groups could not be loaded.
        </p>
      )}
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
                  {groupID && platform && id && (
                    <td
                      className={`px-3 py-1.5 w-[8rem] ${cellBorderClass} text-center`}
                    >
                      <span className="whitespace-nowrap">
                        {solvedStatus === 'loading'
                          ? 'Loading…'
                          : solvedStatus === 'error'
                            ? 'Unavailable'
                            : `Solved: ${solvedCounts.problems[`${platform}:${id}`] ?? 0}/${solvedCounts.studentCount}`}
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
                        <PencilSquareIcon className="inline h-4 w-4" />
                      </a>
                    )}
                    <a
                      title="Open original problem"
                      className={`${iconButtonClass} inline-block`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ArrowTopRightOnSquareIcon className="inline h-4 w-4" />
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
        <Suspense
          fallback={<div className="p-4">Loading problem library…</div>}
        >
          <PageContent />
        </Suspense>
      </WithTeacherLogin>
    </>
  );
}
