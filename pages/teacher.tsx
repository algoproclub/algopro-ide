import React, { useEffect, useState } from 'react';
import { Listbox, Transition, Disclosure } from '@headlessui/react';
import { getDatabase, ref, get } from 'firebase/database';
import { FileData } from '../src/context/EditorContext';
import { StatusData } from '../src/types/problem';
import { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import dynamic from 'next/dynamic';
import LoadingIndicator from '../src/components/LoadingIndicator';

const FontAwesomeIcon = dynamic<FontAwesomeIconProps>(
  () =>
    import('@fortawesome/react-fontawesome').then(mod => mod.FontAwesomeIcon),
  {
    ssr: false,
  }
);

const editTimeList = [
  'In 5 minutes',
  'In 15 minutes',
  'In 1 hour',
  'In 3 hours',
  'In 12 hours',
  'In 1 day',
  'In 7 days',
];
const timeInMillis = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  3 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
];

const headers = [
  'Workspace name',
  'Owner',
  'Last verdict',
  'Last edit',
  'Code size',
];

type SortOptions = {
  by: number;
  order: number;
};

type PageData = {
  current: number;
  max: number;
};

const VERDICT_TYPES = [
  'pending',
  'accepted',
  'incorrect',
  'error',
  'untried',
] as const;
type VerdictTuple = typeof VERDICT_TYPES;
type VerdictType = VerdictTuple[number];

type MainFileData = {
  workspaceName: string;
  owner: string;
  fileID: string;
  lastVerdict: string;
  verdictType: VerdictType;
  hasProblem: boolean;
  lastEdit: number;
  codeSize: number;
};

type ShowVerdict = {
  [v in VerdictType]: boolean;
};

const db = getDatabase();
const maxPageLength = 16;

const unixToDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString('hu-HU');
};

const capitalize = (text: string) => {
  return text[0].toUpperCase() + text.slice(1);
};

const Pagination = ({
  pageData,
  onChange,
}: {
  pageData: PageData;
  onChange: (page: number) => void;
}) => {
  const PageButton = ({ page }: { page: number }) => {
    if (page <= 0 || page > pageData.max) {
      return null;
    }
    return (
      <button
        className={`px-3 py-1.5 rounded border ${
          page === pageData.current
            ? 'bg-indigo-600 border-indigo-600'
            : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800 active:bg-gray-700'
        }`}
        onClick={() => onChange(page)}
      >
        {page}
      </button>
    );
  };
  return (
    <>
      <button
        className="px-3 py-1 rounded border border-gray-600 flex items-center justify-center hover:border-gray-500 hover:bg-gray-800 active:bg-gray-700"
        onClick={() => onChange(1)}
      >
        <FontAwesomeIcon
          icon={{ prefix: 'fas', iconName: 'angles-left' }}
          className="w-3 h-3"
        />
      </button>
      {pageData.current >= 4 && (
        <div className="flex items-center">
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'ellipsis' }}
            className="w-3 h-3 px-2"
          />
        </div>
      )}
      <PageButton page={pageData.current - 2} />
      <PageButton page={pageData.current - 1} />
      <PageButton page={pageData.current} />
      <PageButton page={pageData.current + 1} />
      <PageButton page={pageData.current + 2} />
      {pageData.current + 3 <= pageData.max && (
        <div className="flex items-center">
          <FontAwesomeIcon
            icon={{ prefix: 'fas', iconName: 'ellipsis' }}
            className="w-3 h-3 px-2"
          />
        </div>
      )}
      <button
        className="px-3 py-1 rounded border border-gray-600 flex items-center justify-center hover:border-gray-500 hover:bg-gray-800 active:bg-gray-700"
        onClick={() => onChange(pageData.max)}
      >
        <FontAwesomeIcon
          icon={{ prefix: 'fas', iconName: 'angles-right' }}
          className="w-3 h-3"
        />
      </button>
    </>
  );
};

const TimeDropdown = ({
  selected,
  setSelected,
}: {
  selected: number;
  setSelected: React.Dispatch<React.SetStateAction<number>>;
}) => {
  return (
    <div className="relative">
      <Listbox value={selected} onChange={index => setSelected(index)}>
        {({ open }) => (
          <>
            <Listbox.Label className="text-sm block mb-1">
              Last edit
            </Listbox.Label>
            <div className="w-full flex space-x-2">
              <div className="w-full text-sm relative z-20">
                <Listbox.Button
                  className={`relative w-full px-3 py-2 text-left rounded-md border truncate ${
                    open
                      ? 'ring-2 ring-indigo-500 border-transparent bg-gray-800'
                      : 'bg-gray-900 hover:bg-gray-800 active:bg-gray-700 border-gray-500 hover:border-gray-500'
                  }`}
                >
                  {editTimeList[selected]}
                </Listbox.Button>
                <Transition
                  enter="transition duration-100 ease-out"
                  enterFrom="transform scale-95 opacity-0"
                  enterTo="transform scale-100 opacity-100"
                  leave="transition duration-75 ease-out"
                  leaveFrom="transform scale-100 opacity-100"
                  leaveTo="transform scale-95 opacity-0"
                >
                  <Listbox.Options className="border border-gray-600 rounded-md bg-gray-900 divide-y divide-gray-700 absolute top-2 w-full cursor-pointer overflow-hidden">
                    {editTimeList.map((val, ind) => (
                      <Listbox.Option
                        className="px-3 py-2 hover:bg-gray-800 active:bg-gray-700"
                        key={ind}
                        value={ind}
                      >
                        {val}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </div>
          </>
        )}
      </Listbox>
    </div>
  );
};

const VerdictDropdown = ({
  showVerdict,
  setShowVerdict,
}: {
  showVerdict: ShowVerdict;
  setShowVerdict: React.Dispatch<React.SetStateAction<ShowVerdict>>;
}) => {
  let text = VERDICT_TYPES.filter(verdict => showVerdict[verdict]).join(', ');
  if (text === '') {
    text = '-';
  }
  return (
    <div className="relative z-0">
      <Listbox value={null} onChange={() => {}}>
        {({ open }) => (
          <>
            <Listbox.Label className="text-sm block mb-1">
              Verdict
            </Listbox.Label>
            <div className="w-full flex space-x-2">
              <div className="w-full text-sm relative z-20">
                <Listbox.Button
                  className={`w-full px-3 py-2 text-left rounded-md border text-gray-300 truncate ${
                    open
                      ? 'ring-2 ring-indigo-500 border-transparent bg-gray-800'
                      : 'bg-gray-900 hover:bg-gray-800 active:bg-gray-700 border-gray-500 hover:border-gray-500'
                  }`}
                >
                  {text}
                </Listbox.Button>
                <Transition
                  enter="transition duration-100 ease-out"
                  enterFrom="transform scale-95 opacity-0"
                  enterTo="transform scale-100 opacity-100"
                  leave="transition duration-75 ease-out"
                  leaveFrom="transform scale-100 opacity-100"
                  leaveTo="transform scale-95 opacity-0"
                >
                  <Listbox.Options
                    static
                    className="z-20 border border-gray-600 rounded-md bg-gray-900 divide-y divide-gray-700 absolute top-2 w-full cursor-pointer overflow-hidden"
                  >
                    {VERDICT_TYPES.map(val => (
                      <Listbox.Option
                        className="px-3 py-2 hover:bg-gray-800 active:bg-gray-700 select-none"
                        onClick={(e: any) => {
                          e.preventDefault();
                          setShowVerdict(prev => ({
                            ...prev,
                            [val]: !prev[val],
                          }));
                        }}
                        key={val}
                        value={val}
                      >
                        <label className="cursor-pointer text-[0.85rem] text-white flex items-center select-none">
                          <input
                            disabled
                            checked={showVerdict[val]}
                            type="checkbox"
                            className="cursor-pointer w-4 h-4 bg-gray-900 checked:bg-indigo-600 checked:focus:bg-indigo-600 checked:focus:hover:bg-indigo-700 checked:hover:bg-indigo-700 focus:ring-0 focus:ring-offset-0"
                          />{' '}
                          <span className="ml-2 mb-0.5">{val}</span>
                        </label>
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </div>
          </>
        )}
      </Listbox>
    </div>
  );
};

export default function TeacherPage() {
  const [selected, setSelected] = useState(0);
  const [showVerdict, setShowVerdict] = useState<ShowVerdict>({
    accepted: true,
    incorrect: true,
    pending: true,
    error: true,
    untried: true,
  });
  const [showNoProblem, setShowNoProblem] = useState(true);
  const [pageData, setPageData] = useState<PageData>({
    current: 1,
    max: 1,
  });
  const [sortOptions, setSortOptions] = useState<SortOptions>({
    by: 0,
    order: 1,
  });
  const [filterInput, setFilterInput] = useState<Partial<MainFileData>>({
    owner: '',
    workspaceName: '',
  });
  const [filter, setFilter] = useState<Partial<MainFileData>>({
    owner: '',
    workspaceName: '',
  });
  const [files, setFiles] = useState<MainFileData[] | null>(null);
  const [shownFiles, setShownFiles] = useState<MainFileData[]>([]);
  const [loading, setLoading] = useState(0);

  useEffect(() => {
    updateFileList();
    document.title = 'Teacher interface - AlgoPro IDE';
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilter(filterInput);
    }, 100);

    return () => clearTimeout(timeout);
  }, [filterInput]);

  useEffect(() => {
    if (files === null) {
      return;
    }
    setShownFiles(sortedFileList(filteredFileList(files)));
  }, [
    files,
    selected,
    showVerdict,
    sortOptions,
    showNoProblem,
    filter.workspaceName,
    filter.owner,
  ]);

  const sortedFileList = (fileList: MainFileData[]) => {
    if (sortOptions.order) {
      fileList.sort((a, b) => {
        let res = 0;
        switch (sortOptions.by) {
          case 0:
            res = a.workspaceName.localeCompare(b.workspaceName);
            break;
          case 1:
            res = a.owner.localeCompare(b.owner);
            break;
          case 2:
            res = a.lastVerdict.localeCompare(b.lastVerdict);
            break;
          case 3:
            res = a.lastEdit < b.lastEdit ? -1 : 1;
            break;
          case 4:
            res = a.codeSize < b.codeSize ? -1 : 1;
            break;
        }
        if (sortOptions.order === 2) {
          res *= -1;
        }
        return res;
      });
    }
    return fileList;
  };
  const filteredFileList = (fileList: MainFileData[]) => {
    const fromTime = Date.now() - timeInMillis[selected];
    return fileList.filter(
      fileData =>
        fileData.lastEdit &&
        fileData.lastEdit >= fromTime &&
        (fileData.hasProblem || showNoProblem) &&
        fileData.workspaceName
          ?.toLowerCase()
          .includes(filter.workspaceName!.toLowerCase()) &&
        fileData.owner.toLowerCase().includes(filter.owner!.toLowerCase()) &&
        showVerdict[fileData.verdictType]
    );
  };
  const updateFileList = async () => {
    setLoading(cnt => cnt + 1);

    const filesObj: { [key: string]: Partial<FileData> } = (
      await get(ref(db, 'files'))
    ).val();
    if (!filesObj) {
      return;
    }
    const fromTime = Date.now() - timeInMillis.slice(-1)[0];
    const newFileList = await Promise.all(
      Object.entries(filesObj)
        .filter(([_, fileData]) => {
          if (!fileData.users) {
            return false;
          }
          const fileOwner = Object.values(fileData.users).find(val => {
            return val.permission === 'OWNER';
          });
          return (
            fileOwner &&
            fileData?.teacher?.editTime &&
            (fileData.teacher.editTime ?? 0) >= fromTime
          );
        })
        .map(async ([fileID, fileData]) => {
          const owner = Object.values(fileData.users!).find(user => {
            return user.permission === 'OWNER';
          })!.name;
          const submission: StatusData | null = (
            await get(ref(db, `submissions/${fileID}/statusData`))
          ).val();

          let verdictMessage = 'not tried';
          let verdictType: VerdictType = 'untried';
          if (submission?.statusCode === 'error') {
            verdictMessage = 'error';
            verdictType = 'error';
          }
          if (submission?.message && submission.statusCode !== 'error') {
            if (submission.statusCode === 'resolved') {
              verdictType =
                submission.message === 'correct answer'
                  ? 'accepted'
                  : 'incorrect';
            } else {
              verdictType = 'pending';
            }
            verdictMessage = submission.message;
          }
          return {
            workspaceName: fileData.settings?.workspaceName ?? '?',
            owner,
            fileID,
            verdictType,
            hasProblem: !!fileData.problem,
            lastVerdict: verdictMessage,
            lastEdit: fileData.teacher!.editTime!,
            codeSize: fileData.teacher!.codeSize!,
          };
        })
    );
    const maxPage = Math.round(Math.ceil(newFileList.length / maxPageLength));
    setPageData({
      current: 1,
      max: Math.max(1, maxPage),
    });
    setFiles(newFileList);
    setLoading(cnt => cnt - 1);
  };
  const changeSorting = (index: number) => {
    setSortOptions(prevSortOptions => {
      if (prevSortOptions.by === index) {
        return { by: index, order: 3 - prevSortOptions.order };
      } else {
        return { by: index, order: 1 };
      }
    });
  };
  const pageContent = shownFiles.slice(
    maxPageLength * (pageData.current - 1),
    maxPageLength * pageData.current
  );

  return (
    <div className="w-full text-white mx-auto pt-4 pb-4 max-w-7xl">
      <div className="mx-4">
        <Disclosure>
          {({ open }) => (
            <>
              <div className="w-full flex items-stretch space-x-2">
                <Disclosure.Button className="w-full">
                  <div
                    className={`flex items-center justify-center w-full border px-4 py-2 rounded-md ${
                      open
                        ? 'bg-gray-800 border-gray-500'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    Filter
                    <FontAwesomeIcon
                      icon={{ prefix: 'fas', iconName: 'chevron-down' }}
                      className={`ml-2 w-3.5 h-3.5 transform duration-200 ${
                        open ? 'rotate-180' : 'rotate-0'
                      }`}
                    />
                  </div>
                </Disclosure.Button>
                <button
                  className="flex items-center justify-center border border-gray-600 px-3 py-1 rounded-lg hover:border-gray-500 hover:bg-gray-800 active:bg-gray-700"
                  onClick={updateFileList}
                >
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'arrows-rotate' }}
                  />
                </button>
              </div>
              <Disclosure.Panel>
                <div className="mt-2 space-y-3 px-6 py-5 border bg-gray-800 border-gray-600 z-10 relative">
                  <TimeDropdown selected={selected} setSelected={setSelected} />
                  <VerdictDropdown
                    showVerdict={showVerdict}
                    setShowVerdict={setShowVerdict}
                  />
                  <label className="w-full inline-block text-sm">
                    Owner
                    <input
                      id="owner"
                      type="text"
                      className="mt-1 w-full bg-gray-900 text-sm focus:ring-indigo-500 rounded-md"
                      value={filterInput.owner}
                      onChange={e =>
                        setFilterInput(prev => {
                          return { ...prev, owner: e.target.value };
                        })
                      }
                    />
                  </label>
                  <label className="w-full inline-block text-sm">
                    Workspace name
                    <input
                      id="workspace"
                      type="text"
                      className="mt-1 w-full bg-gray-900 text-sm focus:ring-indigo-500 rounded-md"
                      value={filterInput.workspaceName}
                      onChange={e =>
                        setFilterInput(prev => {
                          return { ...prev, workspaceName: e.target.value };
                        })
                      }
                    />
                  </label>
                  <label className="text-[0.85rem] text-white flex items-center select-none">
                    <input
                      checked={showNoProblem}
                      onChange={() => setShowNoProblem(val => !val)}
                      type="checkbox"
                      className="w-4 h-4 bg-gray-900 checked:bg-indigo-600 checked:focus:bg-indigo-600 checked:focus:hover:bg-indigo-700 checked:hover:bg-indigo-700 focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="ml-2 mb-0.5">
                      Show files with missing problem
                    </span>
                  </label>
                </div>
              </Disclosure.Panel>
            </>
          )}
        </Disclosure>
        <div
          className={`mt-3 border border-gray-600 overflow-x-auto bg-gray-900 ${
            loading ? 'border-opacity-75' : 'border-opacity-100'
          } relative z-0`}
        >
          <div
            className={`absolute w-8 h-8 top-1/2 left-1/2 -mt-4 ${
              loading ? 'opacity-90' : 'opacity-[1%]'
            } transition-all duration-200 z-10`}
          >
            <LoadingIndicator />
          </div>
          <table
            className={`table-auto w-full bg-gray-800 divide-y divide-gray-600 text-sm ${
              loading ? 'opacity-60 pointer-events-none' : 'opacity-100'
            } transition duration-200`}
          >
            <thead>
              <tr className="divide-x divide-gray-600 select-none">
                {headers.map((val, ind) => (
                  <th
                    key={ind}
                    className="px-4 py-3 text-left whitespace-nowrap cursor-pointer hover:bg-gray-700 active:bg-gray-600 space-x-2"
                    onClick={() => changeSorting(ind)}
                  >
                    <span>{val}</span>
                    {sortOptions.by !== ind && (
                      <FontAwesomeIcon
                        className="w-3 h-3"
                        icon={{ prefix: 'fas', iconName: 'sort' }}
                      />
                    )}
                    {sortOptions.by === ind && sortOptions.order === 0 && (
                      <FontAwesomeIcon
                        className="w-3 h-3"
                        icon={{ prefix: 'fas', iconName: 'sort' }}
                      />
                    )}
                    {sortOptions.by === ind && sortOptions.order === 1 && (
                      <FontAwesomeIcon
                        className="w-3 h-3"
                        icon={{ prefix: 'fas', iconName: 'sort-up' }}
                      />
                    )}
                    {sortOptions.by === ind && sortOptions.order === 2 && (
                      <FontAwesomeIcon
                        className="w-3 h-3"
                        icon={{ prefix: 'fas', iconName: 'sort-down' }}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody
              className={`bg-gray-900 divide-y divide-gray-700 min-h-[10rem]`}
            >
              {!pageContent?.length && (
                <tr>
                  <td colSpan={5} className="h-6"></td>
                </tr>
              )}
              {pageContent?.map((data, ind) => (
                <tr className="divide-x divide-gray-600" key={ind}>
                  <>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <a
                        href={`/${data.fileID.slice(1)}`}
                        className="text-indigo-300 hover:underline"
                        target="_blank"
                      >
                        {data.workspaceName}
                      </a>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {data.owner}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        {data.verdictType === 'pending' && (
                          <FontAwesomeIcon
                            icon={{ prefix: 'fas', iconName: 'cog' }}
                            className="w-3.5 h-3.5 text-gray-400 animate-spin-slow"
                          />
                        )}
                        {data.verdictType === 'untried' && (
                          <FontAwesomeIcon
                            icon={{ prefix: 'fas', iconName: 'ellipsis' }}
                            className="w-3.5 h-3.5 text-gray-500"
                          />
                        )}
                        {data.verdictType === 'error' && (
                          <FontAwesomeIcon
                            icon={{
                              prefix: 'fas',
                              iconName: 'exclamation-triangle',
                            }}
                            className="w-3.5 h-3.5 text-yellow-500"
                          />
                        )}
                        {data.verdictType === 'accepted' && (
                          <FontAwesomeIcon
                            icon={{ prefix: 'fas', iconName: 'check' }}
                            className="w-3.5 h-3.5 text-green-500"
                          />
                        )}
                        {data.verdictType === 'incorrect' && (
                          <FontAwesomeIcon
                            icon={{ prefix: 'fas', iconName: 'xmark' }}
                            className="w-3.5 h-3.5 text-red-500"
                          />
                        )}
                        <span className="ml-2">
                          {capitalize(data.lastVerdict)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {unixToDate(data.lastEdit)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {data.codeSize}
                    </td>
                  </>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-x-1 flex items-stretch text-sm">
          <Pagination
            pageData={pageData}
            onChange={(page: number) =>
              setPageData(data => {
                return {
                  current: page,
                  max: data.max,
                };
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
