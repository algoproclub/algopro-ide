import React, { useEffect, useState } from 'react';
import withTeacherLogin from '../../src/scripts/withTeacherLogin';
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
import { URLProblem } from '../../src/types/problem';
import { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import dynamic from 'next/dynamic';
import { getPlatformName } from '../../src/scripts/getPlatformName';
import { EditInlineTextModal } from '../../src/components/EditTextModal';
import { parseProblem } from '../../src/scripts/parseProblem';
import { Disclosure } from '@headlessui/react';

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
  data,
  unsaved,
  onDelete,
  onSave,
  onUpdate,
}: {
  classID: string;
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
                <button
                  className="rounded-md border border-gray-600 px-2 py-1 hover:bg-gray-700 active:bg-gray-600"
                  onClick={() => {
                    setURL('');
                    setOnSaveTask((_: any) => (url: string) => {
                      const newTask = parseProblem(url);
                      onUpdate({
                        ...data,
                        tasks: [...data.tasks, newTask],
                      });
                    });
                    setIsOpen(true);
                  }}
                >
                  New
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'plus' }}
                    className="ml-2"
                  />
                </button>
              </div>
              <div className="divide-y divide-gray-700 text-sm border-b border-gray-600">
                {data.tasks.map(({ platform, id, url }, index) => (
                  <div className="flex items-center justify-between bg-gray-900">
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

export default withTeacherLogin(() => {
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
    loadData();
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
    </div>
  );
});
