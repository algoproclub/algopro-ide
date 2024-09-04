import React, { useCallback, useEffect, useState } from 'react';
import { CodeEditor } from '../../../src/components/editor/CodeEditor';
import { useRouter } from 'next/router';
import {
  doc,
  getFirestore,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import { Language, Platform, ProblemData } from '../../../src/types/problem';
import Markdown from '../../../src/components/JudgeInterface/Markdown';
import dynamic from 'next/dynamic';
import HTMLStatement from '../../../src/components/JudgeInterface/HTMLStatement';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { LanguageSelectorDropdown } from '../../../src/components/JudgeInterface/GenericJudgeInterface';
import {
  EditTextAreaModal,
  EditTextModal,
  handleKeyDown,
} from '../../../src/components/EditTextModal';
import WithTeacherLogin from '../../../src/components/WithTeacherLogin';
import { Hint } from '../../../src/types/problem';
import Dropdown from '../../../src/components/Dropdown';
import Checkbox from '../../../src/components/Checkbox';

const FontAwesomeIcon = dynamic<FontAwesomeIconProps>(
  () =>
    import('@fortawesome/react-fontawesome').then(mod => mod.FontAwesomeIcon),
  {
    ssr: false,
  }
);

const translate = httpsCallable<
  {
    text: string;
    lang: string;
  },
  string
>(getFunctions(undefined, 'europe-west1'), 'translate');

const HTMLEditor = ({
  text,
  onChange,
  path,
  readonly,
  unsaved,
}: {
  text: string;
  path: string;
  readonly: boolean;
  unsaved?: boolean;
  onChange?: (val: string) => void;
}) => {
  const ModeButton = ({
    text,
    active,
    onClick,
  }: {
    text: string;
    active: boolean;
    onClick: () => void;
  }) => {
    return (
      <button
        className={`px-3 py-1.5 rounded-md ${
          active ? 'bg-gray-700' : 'hover:bg-[#363636]'
        } text-sm`}
        onClick={onClick}
      >
        {text}
      </button>
    );
  };
  const [mode, setMode] = useState('code');
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div
      className={` ${
        fullscreen ? 'fixed flex flex-col inset-0 z-50 !m-0' : 'w-full'
      } border border-gray-600 bg-gray-800`}
    >
      <div className="flex items-center justify-between w-full px-3 py-2.5 bg-gray-800 border-b border-gray-600">
        <div className="flex space-x-2 items-center">
          <button
            className={`flex items-center justify-center px-2.5 py-2 rounded-md mr-0.5 hover:bg-gray-700 border border-gray-700`}
            onClick={() => setFullscreen(value => !value)}
          >
            <FontAwesomeIcon
              icon={{
                prefix: 'fas',
                iconName: `${fullscreen ? 'compress' : 'expand'}`,
              }}
            />
          </button>
          <ModeButton
            text="Code"
            active={mode === 'code'}
            onClick={() => {
              setMode('code');
            }}
          />
          <ModeButton
            text="Preview"
            active={mode === 'preview'}
            onClick={() => {
              setMode('preview');
            }}
          />
          <ModeButton
            text="Split"
            active={mode === 'split'}
            onClick={() => {
              setMode('split');
            }}
          />
        </div>
        {!readonly && (
          <div className="flex text-sm space-x-0.5">
            {unsaved && (
              <>
                <span className="text-gray-300">[Unsaved]</span>
                <span className="text-[0.65rem] text-yellow-500 px-2">
                  &#9679;
                </span>
              </>
            )}
            {!unsaved && (
              <>
                <span className="text-gray-300">[Saved]</span>
                <span className="text-[0.65rem] text-green-500 px-2">
                  &#9679;
                </span>
              </>
            )}
          </div>
        )}
      </div>
      <div
        className={`${fullscreen ? `h-full` : 'h-48 md:h-96'} ${
          mode === 'split' ? 'divide-x divide-gray-600' : ''
        } relative flex-1`}
      >
        <div
          className={`absolute border-gray-600 ${
            mode === 'preview' ? 'hidden' : ''
          } top-0 left-0 bottom-0 ${
            mode === 'split' ? 'right-1/2' : 'right-0'
          }`}
        >
          <CodeEditor
            onChange={onChange}
            value={text}
            language="html"
            theme="dark"
            path={path}
            options={{
              readOnly: readonly,
              wordWrap: 'on',
              automaticLayout: true,
              minimap: { enabled: false },
            }}
          />
        </div>
        {mode !== 'code' && (
          <div
            className={`absolute top-0 right-0 bottom-0 ${
              mode === 'split' ? 'left-1/2' : 'left-0'
            } px-4 py-2 overflow-scroll`}
          >
            <HTMLStatement htmlContent={text} />
          </div>
        )}
      </div>
    </div>
  );
};

const EditHintModal = ({
  isOpen,
  hint,
  setHint,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  hint: Hint;
  setHint: React.Dispatch<React.SetStateAction<Hint>>;
  onSave: (h: Hint) => void;
  onClose: () => void;
}) => {
  const [selected, setSelected] = useState(0);
  const confirmedToggle = () => {
    if (
      confirm(
        "If you switch, the hint's content will be deleted. Do you want to proceed?"
      )
    ) {
      setHint(h => {
        if (typeof h == 'string') {
          return {} as Hint;
        } else {
          return '';
        }
      });
    }
  };

  const checked = typeof hint != 'string';
  const langs: Language[] = ['cpp', 'py', 'java'];
  const selectedLang = langs[selected];
  const text = checked ? hint[selectedLang] ?? '' : hint;

  return (
    <EditTextModal
      isOpen={isOpen}
      title="Edit hint"
      text={text}
      onSave={(_: string) => onSave(hint)}
      onClose={onClose}
    >
      <div className="space-y-2">
        <Dropdown
          items={['cpp', 'py', 'java']}
          label="Language"
          selected={selected}
          setSelected={setSelected}
          disabled={!checked}
        />
        <div className="pl-1">
          <Checkbox
            checked={checked}
            label="Language-dependent hint"
            toggleChecked={confirmedToggle}
          />
        </div>
        <textarea
          className="font-mono h-60 bg-gray-900 border-gray-700 w-full min-h-[10rem] text-sm"
          value={text}
          onKeyDown={handleKeyDown}
          onChange={e =>
            setHint(h => {
              const val = e.target.value;
              if (typeof h == 'string') {
                return val;
              } else if (val !== '') {
                return { ...h, [selectedLang]: val };
              } else {
                return Object.fromEntries(
                  Object.entries(h).filter(([key]) => key !== selectedLang)
                ) as Hint;
              }
            })
          }
        />
      </div>
    </EditTextModal>
  );
};

const PageContent = () => {
  const Hint = ({
    hint,
    hintNum,
    onDelete,
    onEdit,
  }: {
    hint: Hint;
    hintNum: number;
    onDelete: () => void;
    onEdit: () => void;
  }) => {
    const isEmpty = (obj: Object): boolean => {
      return Object.keys(obj).length === 0;
    };
    const hintObj =
      typeof hint == 'string'
        ? { '': hint }
        : isEmpty(hint)
        ? { '': 'No hint specified' }
        : hint;
    const rowCount = Object.keys(hintObj).length;
    return (
      <>
        {Object.entries(hintObj).map(([lang, text], i) => (
          <tr key={i}>
            {i === 0 && (
              <td
                className="w-10 py-2 px-3 border-x border-gray-700"
                rowSpan={rowCount}
              >
                {hintNum}
              </td>
            )}
            {lang !== '' && (
              <td className="w-16 py-2 px-3 border-x border-gray-700">
                {lang}
              </td>
            )}
            <td
              className={`py-2 px-3 border-x border-gray-700 ${
                isEmpty(hint) ? 'text-gray-400' : ''
              }`}
              colSpan={lang === '' ? 2 : 1}
            >
              {text}
            </td>
            {i === 0 && (
              <td
                className="space-x-1 px-3 py-2 w-24 border-x border-gray-700"
                rowSpan={rowCount}
              >
                <button
                  className="px-2 py-1 rounded-md hover:bg-gray-700"
                  onClick={onEdit}
                >
                  <FontAwesomeIcon icon={{ prefix: 'fas', iconName: 'edit' }} />
                </button>
                <button
                  className="px-2 py-1 rounded-md hover:bg-gray-700"
                  onClick={onDelete}
                >
                  <FontAwesomeIcon
                    icon={{ prefix: 'fas', iconName: 'trash' }}
                  />
                </button>
              </td>
            )}
          </tr>
        ))}
      </>
    );
  };
  const [original, setOriginal] = useState('');
  const [translated, setTranslated] = useState('');
  const [initTranslated, setInitTranslated] = useState('');
  const [platform, setPlatform] = useState<string | null>(null);
  const [problemID, setProblemID] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hints, setHints] = useState<Hint[]>([]);
  const [editedHint, setEditedHint] = useState<Hint>('');
  const [onSaveHint, setOnSaveHint] = useState<() => (h: Hint) => void>(
    () => _ => {}
  );
  const [unsaved, setUnsaved] = useState(false);
  const [language, setLanguage] = useState('-');
  const router = useRouter();

  const getTranslated = async (platform: string, id: string) => {
    if (language === '-') {
      const problemRef = doc(
        getFirestore(),
        'problemsets',
        platform,
        'problems',
        id
      );
      const snapshot = await getDoc(problemRef);
      return snapshot.data();
    } else {
      const problemRef = doc(
        getFirestore(),
        'problemsets',
        platform,
        'problems',
        id,
        'translations',
        language
      );
      const snapshot = await getDoc(problemRef);
      return snapshot.data();
    }
  };
  const updateTranslated = () => {
    if (!platform || !problemID) {
      return;
    }
    getTranslated(platform, problemID)
      .then(data => {
        setUnsaved(false);
        setInitTranslated(data?.statement ?? '');
        setTranslated(data?.statement ?? '');
        setHints(data?.hints ?? []);
      })
      .catch(error => {
        console.error(error);
      });
  };

  useEffect(() => {
    if (typeof router.query.platform === 'string') {
      setPlatform(router.query.platform);
    }
    if (typeof router.query.id === 'string') {
      setProblemID(router.query.id);
    }
  }, [router]);

  useEffect(() => {
    const getOriginal = async (
      platform: string,
      id: string
    ): Promise<ProblemData> => {
      const resp = await fetch('/api/fetchProblemData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: platform as Platform,
          id,
        }),
      });
      const problemData: ProblemData | null = await resp.json();
      if (problemData === null) {
        throw Error('data fetching was unsuccessful');
      }
      return problemData;
    };
    if (!platform || !problemID) {
      return;
    }
    getOriginal(platform, problemID)
      .then(data => {
        setOriginal(data.statement ?? '');
      })
      .catch(error => {
        console.error(error);
      });
    updateTranslated();
  }, [platform, problemID]);

  useEffect(() => {
    if (!platform || !problemID) {
      return;
    }
    updateTranslated();
  }, [language, original]);

  const handleChange = useCallback((val: string) => {
    if (translated !== val) {
      setTranslated(val);
    }
  }, []);

  useEffect(() => {
    if (translated !== initTranslated) {
      setUnsaved(true);
    }
  }, [translated]);

  const handleSave = async () => {
    if (!platform || !problemID) {
      return;
    }
    const problemDoc =
      language !== '-'
        ? doc(
            getFirestore(),
            'problemsets',
            platform,
            'problems',
            problemID,
            'translations',
            language
          )
        : doc(getFirestore(), 'problemsets', platform, 'problems', problemID);

    const newData = {
      statement: translated,
      hints,
    };
    if (language === '-') {
      await updateDoc(problemDoc, newData);
    } else {
      await setDoc(problemDoc, newData);
    }
    setUnsaved(false);
  };

  const handleAddNewHint = () => {
    setEditedHint('');
    setOnSaveHint(() => (h: Hint) => {
      setUnsaved(true);
      setHints(prev => [...prev, h]);
    });
    setIsOpen(true);
  };

  const handleAutoTranslate = async () => {
    const response = await translate({
      text: original,
      lang: language,
    });
    if (response.data !== null) {
      setTranslated(response.data);
    } else {
      console.error('unsuccessful translation');
    }
  };

  return (
    <div className="p-3 text-white max-w-[1440px] mx-auto">
      <div className="relative z-30 mb-2">
        <LanguageSelectorDropdown
          languages={['-', 'hu', 'en', 'es']}
          language={language}
          setLanguage={(text: string) => {
            if (
              !unsaved ||
              confirm(
                'The unsaved changes will be lost. Do you want to proceed?'
              )
            ) {
              setLanguage(text);
            }
          }}
        />
      </div>
      <EditHintModal
        isOpen={isOpen}
        hint={editedHint}
        setHint={setEditedHint}
        onSave={onSaveHint}
        onClose={() => setIsOpen(false)}
      />
      <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
        <HTMLEditor path="original" readonly={true} text={original} />
        <HTMLEditor
          path="translated"
          readonly={false}
          text={translated}
          onChange={handleChange}
          unsaved={unsaved}
        />
      </div>
      <div className="bg-gray-800 mt-2 flex flex-col">
        <div className="border border-gray-600 flex items-center justify-between bg-gray-800 px-3 py-2 border-b text-sm space-x-2">
          <span className="font-bold">Hints</span>
          <button
            className="rounded-md border border-gray-600 px-2 py-1 hover:bg-gray-700 active:bg-gray-600"
            onClick={handleAddNewHint}
          >
            New
            <FontAwesomeIcon
              icon={{ prefix: 'fas', iconName: 'plus' }}
              className="ml-2"
            />
          </button>
        </div>
        <div className="max-h-[16rem] border-b border-gray-700 overflow-auto">
          <table className="text-sm bg-gray-900 border-collapse">
            <tbody className="divide-y divide-gray-700">
              {hints.map((hint: Hint, index: number) => (
                <Hint
                  hint={hint}
                  hintNum={index + 1}
                  key={index}
                  onDelete={() => {
                    if (
                      confirm(
                        'The hint will be deleted. Do you want to proceed?'
                      )
                    ) {
                      setUnsaved(true);
                      setHints(prev => {
                        return prev.filter((_, ind) => ind !== index);
                      });
                    }
                  }}
                  onEdit={() => {
                    setEditedHint(hint);
                    setOnSaveHint(
                      () => (h: Hint) =>
                        setHints(prev => {
                          setUnsaved(true);
                          prev[index] = h;
                          return prev;
                        })
                    );
                    setIsOpen(true);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="p-4 border border-gray-600 bg-gray-800 mt-2 space-x-2 text-[0.95rem]">
        <button
          className="px-4 py-2 rounded-md border border-gray-600 hover:bg-gray-700 active:bg-gray-600"
          onClick={handleAutoTranslate}
        >
          Auto translate
        </button>
        <button
          className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
          onClick={handleSave}
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default function EditPage() {
  return (
    <WithTeacherLogin>
      <PageContent />
    </WithTeacherLogin>
  );
}
