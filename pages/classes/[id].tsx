import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  setDoc,
} from 'firebase/firestore';
import { Platform, ProblemData, URLProblem } from '../../src/types/problem';
import { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import dynamic from 'next/dynamic';
import { getPlatformName } from '../../src/scripts/getPlatformName';
import { EditInlineTextModal } from '../../src/components/EditTextModal';
import { parseProblem } from '../../src/scripts/parseProblem';
import { Disclosure } from '@headlessui/react';
import WithTeacherLogin from '../../src/components/WithTeacherLogin';
import fetchProblemData from '../api/fetchProblemData';

const firestore = getFirestore();
const FontAwesomeIcon = dynamic<FontAwesomeIconProps>(
  () =>
    import('@fortawesome/react-fontawesome').then(mod => mod.FontAwesomeIcon),
  {
    ssr: false,
  }
);

type ClassData = {
  tasks: URLProblem[];
  creationTime: number;
};

type Classes = {
  [id: string]: ClassData;
};

const EditTaskModal = ({
  isOpen,
  text,
  setText,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  onSave: (text: string) => void;
  onClose: () => void;
}) => {
  return (
    <EditInlineTextModal
      isOpen={isOpen}
      text={text}
      title="Edit task"
      setText={setText}
      onSave={onSave}
      onClose={onClose}
    />
  );
};

const ClassDropdown = ({
  classID,
  group,
  data,
  unsaved,
  onDelete,
  onSave,
  onUpdate,
}: {
  classID: string;
  group: string;
  data: ClassData;
  unsaved: boolean;
  onDelete: () => void;
  onSave: () => void;
  onUpdate: (data: ClassData) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setURL] = useState('');
  const [onSaveTask, setOnSaveTask] = useState<(text: string) => void>(
    () => (_: string) => {}
  );
  const copyContent = () => {
    const prefix = `${group[0].toUpperCase()}.${classID}`;
    const textContent = data.tasks
      .map((task, i) => {
        return `${prefix}.${i + 1}. ${
          task.title ? task.title : '-'
        }\nhttps://ide.algopro.hu/solve/${task.platform}/${task.id}`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(textContent).then(
      () => {},
      () => {
        alert("Couldn't copy to clipboard");
      }
    );
  };
  const addNewTasks = () => {
    setURL('');
    setOnSaveTask((_: any) => async (input: string) => {
      const newTasks = (
        await Promise.all(
          input
            .split(/\s+/)
            .filter(token => token.startsWith('https://'))
            .map(parseProblem)
            .map(async problem => {
              if (problem.platform && problem.id) {
                const resp = await fetch('/api/fetchProblemData', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    platform: problem.platform,
                    id: problem.id,
                  }),
                });
                try {
                  const problemData: ProblemData | null = await resp.json();
                  if (!problemData) {
                    return null;
                  }
                  return { ...problem, title: problemData.title };
                } catch {
                  alert(`Could not parse ${url}`);
                  return null;
                }
              } else {
                return { ...problem, title: null };
              }
            })
        )
      )
        .filter(problem => problem !== null)
        .map(problem => problem as URLProblem);
      if (newTasks.length > 0) {
        onUpdate({
          ...data,
          tasks: data.tasks.concat(newTasks),
        });
      }
    });
    setIsOpen(true);
  };
  return (
    <>
      <EditTaskModal
        isOpen={isOpen}
        text={url}
        setText={setURL}
        onSave={onSaveTask}
        onClose={() => setIsOpen(false)}
      />
      <Disclosure>
        {({ open }) => (
          <div className="space-y-2">
            <Disclosure.Button className="w-full">
              <div
                className={`flex items-center justify-center w-full border px-4 py-2.5 rounded-md border-gray-600 hover:border-gray-500 text-[0.95rem] bg-gray-800`}
              >
                Class {classID}
                <FontAwesomeIcon
                  icon={{ prefix: 'fas', iconName: 'chevron-down' }}
                  className={`ml-2 w-3.5 h-3.5 transform duration-200 ${
                    open ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </div>
            </Disclosure.Button>
            <Disclosure.Panel className="relative border border-gray-600">
              <div className="flex items-center justify-between bg-gray-800 px-3 py-2 border-b border-gray-600 text-sm space-x-2">
                <div className="flex items-center space-x-2">
                  <span className="font-bold">Tasks</span>
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'circle' }}
                    className={`w-[0.45rem] h-[0.45rem] ${
                      unsaved ? 'text-yellow-500' : 'text-green-500'
                    }`}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    className="rounded-md border border-gray-600 px-2 py-1 hover:bg-gray-700 active:bg-gray-600"
                    onClick={copyContent}
                  >
                    Copy
                    <FontAwesomeIcon
                      icon={{ prefix: 'far', iconName: 'copy' }}
                      className="ml-2"
                    />
                  </button>
                  <button
                    className="rounded-md border border-gray-600 px-2 py-1 hover:bg-gray-700 active:bg-gray-600"
                    onClick={addNewTasks}
                  >
                    New
                    <FontAwesomeIcon
                      icon={{ prefix: 'fas', iconName: 'plus' }}
                      className="ml-2"
                    />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-700 text-sm border-b border-gray-600">
                {data.tasks.map(({ platform, id, url }, index) => (
                  <div
                    key={index}
                    className="flex items-stretch justify-between bg-gray-900"
                  >
                    <a
                      href={url}
                      className="px-3 py-2 underline hover:text-indigo-200"
                      target="_blank"
                    >
                      {platform && (
                        <>
                          {getPlatformName(platform)} {id}
                        </>
                      )}
                      {!platform && <>{url}</>}
                    </a>
                    <div className="border-l px-3 py-2 border-gray-700 flex items-center space-x-2">
                      {platform && id && (
                        <a
                          title="Jump to edit interface"
                          className="px-2 py-1 rounded-md hover:bg-gray-700"
                          href={`/edit/${platform}/${id}`}
                          target="_blank"
                        >
                          <FontAwesomeIcon
                            icon={{ prefix: 'fas', iconName: 'arrow-right' }}
                            className="w-3.5 h-3.5"
                          />
                        </a>
                      )}
                      {(!platform || !id) && (
                        <div className="w-[1.875rem]"></div>
                      )}
                      <button
                        title="Edit task"
                        className="px-2 py-1 rounded-md hover:bg-gray-700"
                        onClick={() => {
                          setURL(url);
                          setOnSaveTask((_: any) => (url: string) => {
                            const newTask = parseProblem(url);
                            const newTasks = data.tasks;
                            newTasks[index] = newTask;
                            onUpdate({
                              ...data,
                              tasks: newTasks,
                            });
                          });
                          setIsOpen(true);
                        }}
                      >
                        <FontAwesomeIcon
                          icon={{ prefix: 'fas', iconName: 'edit' }}
                          className="w-3.5 h-3.5"
                        />
                      </button>
                      <button
                        title="Delete task"
                        className="px-2 py-1 rounded-md hover:bg-gray-700"
                        onClick={() => {
                          onUpdate({
                            ...data,
                            tasks: data.tasks.filter((_, i) => i !== index),
                          });
                        }}
                      >
                        <FontAwesomeIcon
                          icon={{ prefix: 'fas', iconName: 'trash' }}
                          className="w-3.5 h-3.5"
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-gray-800 space-x-2.5 text-[0.95rem]">
                <button
                  className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
                  onClick={onSave}
                >
                  Save
                </button>
                <button
                  className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 active:bg-red-800"
                  onClick={onDelete}
                >
                  Delete
                </button>
              </div>
            </Disclosure.Panel>
          </div>
        )}
      </Disclosure>
    </>
  );
};

const PageContent = () => {
  const router = useRouter();
  const [group, setGroup] = useState<string | null>(null);
  const [classes, setClasses] = useState<Classes>({});
  const [newID, setNewID] = useState('');
  const [unsaved, setUnsaved] = useState(new Set<string>());

  document.title = `[${group}] class editor`;

  useEffect(() => {
    if (typeof router.query.id === 'string') {
      setGroup(router.query.id);
    }
  }, [router]);

  useEffect(() => {
    const loadData = async () => {
      const results = await getDocs(
        query(collection(firestore, `groups/${group}/classes`))
      );
      const classes: Classes = {};
      results.forEach(doc => {
        classes[doc.id] = doc.data() as ClassData;
      });
      setClasses(classes);
    };
    loadData().then(() => {
      console.log('done');
    });
  }, [group]);

  const handleDeleteClass = async (id: string) => {
    if (
      confirm(
        `Class ${id} will be irreversibly deleted. Do you want to proceed?`
      )
    ) {
      await deleteDoc(doc(firestore, 'groups', group!, 'classes', id));
      setClasses(prev => {
        const filtered = Object.entries(prev).filter(([cid, _]) => cid !== id);
        return Object.fromEntries(filtered);
      });
    }
  };

  const handleSaveClass = async (id: string) => {
    await setDoc(doc(firestore, 'groups', group!, 'classes', id), classes[id]);
    setUnsaved(prev => {
      const filtered = Object.keys(prev).filter(cid => cid !== id);
      return new Set<string>(filtered);
    });
  };

  const handleUpdateClass = (id: string, data: ClassData) => {
    setClasses(prev => {
      return { ...prev, [id]: data };
    });
    setUnsaved(prev => new Set<string>([...prev.values(), id]));
  };

  return (
    <div className="px-2">
      {group && (
        <div className="mx-auto max-w-7xl mt-4 space-y-3">
          <div className="p-4 border border-gray-600 bg-gray-800 flex items-end space-x-3 text-sm">
            <label className="w-full">
              Class ID
              <input
                type="text"
                className="mt-1 w-full bg-gray-900 border border-gray-600 text-sm"
                onChange={e => setNewID(e.target.value)}
              />
            </label>
            <button
              className="flex-shrink-0 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-md"
              onClick={() => {
                if (classes.hasOwnProperty(newID)) {
                  alert('The entered ID already exists.');
                  return;
                }
                if (newID === '') {
                  alert('Please enter a non-empty ID.');
                  return;
                }
                handleUpdateClass(newID, {
                  tasks: [],
                  creationTime: Date.now(),
                });
              }}
            >
              New class
              <FontAwesomeIcon
                icon={{ prefix: 'fas', iconName: 'plus' }}
                className="ml-2"
              />
            </button>
          </div>
          <div className="space-y-3">
            {Object.entries(classes)
              .sort(
                ([id1, data1], [id2, data2]) =>
                  data2.creationTime - data1.creationTime
              )
              .map(([id, data]) => (
                <ClassDropdown
                  key={id}
                  group={group}
                  classID={id}
                  data={data}
                  unsaved={unsaved.has(id)}
                  onDelete={() => handleDeleteClass(id)}
                  onSave={() => handleSaveClass(id)}
                  onUpdate={(data: ClassData) => handleUpdateClass(id, data)}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ClassEditPage() {
  return (
    <WithTeacherLogin>
      <PageContent />
    </WithTeacherLogin>
  );
}
