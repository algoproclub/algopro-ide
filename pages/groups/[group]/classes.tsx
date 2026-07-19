import React, { Dispatch, useEffect, useState, SetStateAction } from 'react';
import { useRouter } from 'next/router';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
} from 'firebase/firestore';
import { ProblemData, URLProblem } from '../../../src/types/problem';
import { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import dynamic from 'next/dynamic';
import { getPlatformName } from '../../../src/scripts/getPlatformName';
import { EditInlineTextModal } from '../../../src/components/EditTextModal';
import { parseProblem } from '../../../src/scripts/parseProblem';
import { Disclosure } from '@headlessui/react';
import WithTeacherLogin from '../../../src/components/WithTeacherLogin';

const firestore = getFirestore();
const FontAwesomeIcon = dynamic<FontAwesomeIconProps>(
  () =>
    import('@fortawesome/react-fontawesome').then(mod => mod.FontAwesomeIcon),
  {
    ssr: false,
  }
);

const panelClass = 'border theme-border theme-surface-raised';
const iconButtonClass =
  'px-2 py-1 rounded-md hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)]';
const secondaryButtonClass =
  'border theme-border theme-button-secondary rounded-md';
const primaryButtonClass = 'theme-button-primary rounded-md';
const dangerButtonClass =
  'bg-[color:var(--danger)] hover:bg-[color:var(--danger-hover)] text-[color:var(--text-inverted)] rounded-md';

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
  setText: Dispatch<SetStateAction<string>>;
  onSave: (text: string) => void;
  onClose: () => void;
}) => {
  return (
    <EditInlineTextModal
      isOpen={isOpen}
      text={text}
      title="Edit task"
      setText={(text: string) => setText(text)}
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
        }\n${process.env.NEXT_PUBLIC_BASE_URL}/solve/${task.platform}/${task.id}`;
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
    setOnSaveTask(() => async (input: string) => {
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
        onSave={(text: string) => {
          onSaveTask(text);
          setIsOpen(false);
        }}
        onClose={() => setIsOpen(false)}
      />
      <Disclosure>
        {({ open }) => (
          <div className="space-y-2">
            <Disclosure.Button className="w-full">
              <div className="flex items-center justify-center w-full border theme-border px-4 py-2.5 rounded-md hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)] text-[0.95rem] theme-surface-raised">
                Class {classID}
                <FontAwesomeIcon
                  icon={{ prefix: 'fas', iconName: 'chevron-down' }}
                  className={`ml-2 w-3.5 h-3.5 transform duration-200 inline ${
                    open ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </div>
            </Disclosure.Button>
            <Disclosure.Panel className="relative border theme-border">
              <div className="flex items-center justify-between theme-surface-raised px-3 py-2 border-b theme-border space-x-2">
                <div className="flex items-center space-x-2">
                  <span className="font-bold">Tasks</span>
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'circle' }}
                    className={`w-[0.45rem] h-[0.45rem] inline ${
                      unsaved ? 'text-yellow-500' : 'text-green-500'
                    }`}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    className={`px-3 py-1.5 flex items-center ${secondaryButtonClass}`}
                    onClick={copyContent}
                  >
                    Copy
                    <FontAwesomeIcon
                      icon={{ prefix: 'far', iconName: 'copy' }}
                      className="ml-2 w-4 h-4 inline"
                    />
                  </button>
                  <button
                    className="rounded-md bg-[color:var(--success)] hover:brightness-95 text-[color:var(--text-inverted)] px-3 py-1.5 flex items-center"
                    onClick={addNewTasks}
                  >
                    <span>New</span>
                    <FontAwesomeIcon
                      icon={{ prefix: 'fas', iconName: 'plus' }}
                      className="ml-2 w-4 h-4 inline"
                    />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-[color:var(--border-muted)] text-sm border-b theme-border">
                {data.tasks.map(({ platform, id, url }, index) => (
                  <div
                    key={index}
                    className="flex items-stretch justify-between theme-surface"
                  >
                    <a
                      href={url}
                      className="px-3 py-2 underline text-[color:var(--accent-hover)] hover:text-[color:var(--accent)]"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {platform && (
                        <>
                          {getPlatformName(platform)} {id}
                        </>
                      )}
                      {!platform && <>{url}</>}
                    </a>
                    <div className="border-l px-3 py-2 border-[color:var(--border-muted)] flex items-center space-x-2">
                      {platform && id && (
                        <a
                          title="Jump to class edit page"
                          className={iconButtonClass}
                          href={`/edit/${platform}/${id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FontAwesomeIcon
                            icon={{ prefix: 'fas', iconName: 'arrow-right' }}
                            className="w-3.5 h-3.5 inline"
                          />
                        </a>
                      )}
                      {(!platform || !id) && (
                        <div className="w-[1.875rem]"></div>
                      )}
                      <button
                        title="Edit task"
                        className={iconButtonClass}
                        onClick={() => {
                          setURL(url);
                          setOnSaveTask(() => (url: string) => {
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
                          className="w-3.5 h-3.5 inline"
                        />
                      </button>
                      <button
                        title="Delete task"
                        className={iconButtonClass}
                        onClick={() => {
                          onUpdate({
                            ...data,
                            tasks: data.tasks.filter((_, i) => i !== index),
                          });
                        }}
                      >
                        <FontAwesomeIcon
                          icon={{ prefix: 'fas', iconName: 'trash' }}
                          className="w-3.5 h-3.5 inline"
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 theme-surface-raised space-x-2.5 text-[0.95rem]">
                <button
                  className={`px-4 py-2 ${primaryButtonClass}`}
                  onClick={onSave}
                >
                  Save
                </button>
                <button
                  className={`px-4 py-2 ${dangerButtonClass}`}
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
  const [groupName, setGroupName] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);
  const [classes, setClasses] = useState<Classes>({});
  const [newID, setNewID] = useState('');
  const [unsaved, setUnsaved] = useState(new Set<string>());

  document.title = `[${group}] class editor`;

  useEffect(() => {
    const initialize = async (group: string) => {
      const groupSnap = await getDoc(doc(firestore, 'groups', group));
      const schoolID = groupSnap.get('school');
      const schoolSnap = await getDoc(doc(firestore, 'schools', schoolID));
      setGroupName(groupSnap.get('name') || groupSnap.id);
      setSchoolName(schoolSnap.get('name') || schoolSnap.id);
    };
    if (typeof router.query.group === 'string') {
      setGroup(router.query.group);
      initialize(router.query.group);
    }
  }, [router]);

  useEffect(() => {
    const loadData = async () => {
      if (group === null) return;
      const results = await getDocs(
        query(collection(firestore, 'groups', group, 'classes'))
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
          <div className={`${panelClass} flex-col`}>
            <div className="p-4 pl-5 border-b theme-border flex justify-between items-center truncate">
              <span className="flex items-center truncate">
                <FontAwesomeIcon
                  className="flex-shrink-0 w-5 h-5 mr-1.5"
                  icon={{ iconName: 'user-group', prefix: 'fas' }}
                />
                <span className="truncate">
                  <span className="font-semibold">{groupName}</span>
                  <span className="ml-1 truncate">({schoolName})</span>
                </span>
              </span>
            </div>
            <div className="p-4 flex items-end space-x-3 w-full">
              <label className="w-full">
                Class ID
                <input
                  type="text"
                  className="mt-1 w-full border theme-input text-sm"
                  onChange={e => setNewID(e.target.value)}
                />
              </label>
              <button
                className="flex-shrink-0 px-4 py-2.5 theme-button-primary rounded-md flex items-center"
                onClick={() => {
                  if (newID in classes) {
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
                  className="ml-2 w-4 h-4 inline"
                />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {Object.entries(classes)
              .sort(
                ([, data1], [, data2]) =>
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
