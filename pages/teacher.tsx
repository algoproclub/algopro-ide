import React, { useEffect, useState } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { getDatabase, ref, get } from 'firebase/database';
import { FileData } from '../src/context/EditorContext';
import { StatusData } from '../src/types/problem';
import { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import dynamic from 'next/dynamic';

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
  'Link',
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

type MainFileData = {
  workspaceName: string;
  owner: string;
  fileID: string;
  lastVerdict: string;
  lastEdit: number;
  codeSize: number;
};

const db = getDatabase();
const maxPageLength = 18;

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

export default function TeacherPage() {
  const [selected, setSelected] = useState(0);
  const [pageData, setPageData] = useState<PageData>({
    current: 1,
    max: 1,
  });
  const [sortOptions, setSortOptions] = useState<SortOptions>({
    by: 0,
    order: 0,
  });
  const [fileList, setFileList] = useState<MainFileData[] | null>(null);

  const sortedFileList = (fileList: MainFileData[] | null) => {
    if (!fileList) {
      return null;
    }
    if (sortOptions.order) {
      fileList.sort((a, b) => {
        let res = 0;
        if (sortOptions.by === 0)
          res = a.workspaceName.localeCompare(b.workspaceName);
        if (sortOptions.by === 1) res = a.owner.localeCompare(b.owner);
        if (sortOptions.by === 2) res = a.fileID.localeCompare(b.fileID);
        if (sortOptions.by === 3)
          res = a.lastVerdict.localeCompare(b.lastVerdict);
        if (sortOptions.by === 4) res = a.lastEdit < b.lastEdit ? -1 : 1;
        if (sortOptions.by === 5) res = a.codeSize < b.codeSize ? -1 : 1;
        if (sortOptions.order === 2) {
          res *= -1;
        }
        return res;
      });
    }
    return fileList;
  };

  const sortFileList = () => {
    setFileList(prevFileList => sortedFileList(prevFileList));
  };

  const updateFileList = async () => {
    const fromTime = Date.now() - timeInMillis[selected];
    const filesObj: { [key: string]: FileData } = (
      await get(ref(db, 'files'))
    ).val();

    if (!filesObj) {
      return;
    }
    const newFileList = await Promise.all(
      Object.entries(filesObj)
        .filter(entry => {
          const data = entry[1];
          return data?.teacher?.editTime && data?.teacher?.editTime >= fromTime;
        })
        .map(async entry => {
          const fileID = entry[0];
          const data = entry[1];

          const owner =
            Array.from(Object.values(data.users)).find(val => {
              return val.permission === 'OWNER';
            })?.name ?? '';
          const submission: StatusData | null = (
            await get(ref(db, `submissions/${fileID}/statusData`))
          ).val();

          const verdict = submission
            ? submission.message ?? 'No verdict'
            : 'No submission';

          return {
            workspaceName: data.settings.workspaceName ?? 'Unnamed',
            owner: owner,
            fileID: fileID,
            lastVerdict: verdict,
            lastEdit: data.teacher.editTime,
            codeSize: data.teacher.codeSize,
          };
        })
    );

    setPageData({
      current: 1,
      max: Math.max(
        1,
        Math.round(Math.ceil(newFileList.length / maxPageLength))
      ),
    });
    setFileList(sortedFileList(newFileList));
  };

  useEffect(() => {
    updateFileList();
  }, [selected]);

  useEffect(() => {
    sortFileList();
    setPageData(prevPageData => {
      return {
        current: 1,
        max: prevPageData.max,
      };
    });
  }, [sortOptions]);

  const changeSorting = (index: number) => {
    setSortOptions(prevSortOptions => {
      if (prevSortOptions.by === index) {
        return { by: index, order: 3 - prevSortOptions.order };
      } else {
        return { by: index, order: 1 };
      }
    });
  };
  const changeSelection = (index: number) => {
    setSelected(index);
  };

  const unixToDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('hu-HU');
  };

  const pageContent = fileList?.slice(
    maxPageLength * (pageData.current - 1),
    maxPageLength * pageData.current
  );

  return (
    <div className="w-full text-white mx-auto pt-8 max-w-7xl">
      <div className="mx-2">
        <Listbox value={2} onChange={changeSelection}>
          {({ open }) => (
            <>
              <Listbox.Label className="text-sm inline-block mb-0.5">
                Last edit
              </Listbox.Label>
              <div className="w-full flex space-x-2">
                <div className="w-full relative text-sm">
                  <Listbox.Button
                    className={`w-full px-3 py-2 text-left rounded-md border ${
                      open
                        ? 'ring-2 ring-indigo-500 border-transparent bg-gray-800'
                        : 'hover:bg-gray-800 active:bg-gray-700 border-gray-600 hover:border-gray-500'
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
                <button
                  className="border border-gray-600 px-3 py-1 rounded-lg hover:border-gray-500 hover:bg-gray-800 active:bg-gray-700"
                  onClick={updateFileList}
                >
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'arrows-rotate' }}
                  />
                </button>
              </div>
            </>
          )}
        </Listbox>
        <div className="mt-3 border border-gray-600 overflow-x-auto">
          <table className="table-auto w-full bg-gray-800 divide-y divide-gray-600 text-sm">
            <thead>
              <tr className="divide-x divide-gray-600 select-none">
                {headers.map((val, ind) => (
                  <th
                    key={ind}
                    className="px-3 py-2 text-left whitespace-nowrap cursor-pointer hover:bg-gray-700 active:bg-gray-600 space-x-2"
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
              className={`bg-gray-900 divide-y divide-gray-700 ${
                pageContent?.length === 0 ? 'hidden' : ''
              }`}
            >
              {pageContent?.map((data, ind) => (
                <tr className="divide-x divide-gray-600" key={ind}>
                  <>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {data.workspaceName}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {data.owner}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <a
                        href={`http://localhost:3000/${data.fileID}`}
                        className="text-indigo-300 hover:underline"
                        target="_blank"
                      >
                        {data.fileID}
                      </a>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {data.lastVerdict}
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
