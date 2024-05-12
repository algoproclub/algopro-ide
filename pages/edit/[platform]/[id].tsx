import React, {
  Fragment,
  KeyboardEventHandler,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { CodeEditor } from '../../../src/components/editor/CodeEditor';
import { Dialog, Transition } from '@headlessui/react';
import { useRouter } from 'next/router';
import { doc, getFirestore, getDoc, setDoc } from 'firebase/firestore';
import { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import { Platform, ProblemData } from '../../../src/types/problem';
import Markdown from '../../../src/components/JudgeInterface/Markdown';
import dynamic from 'next/dynamic';
import { XMarkIcon } from '@heroicons/react/24/outline';
import HTMLStatement from '../../../src/components/JudgeInterface/HTMLStatement';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { LanguageSelectorDropdown } from '../../../src/components/JudgeInterface/GenericJudgeInterface';
import withTeacherLogin from '../../../src/scripts/withTeacherLogin';
import { EditTextAreaModal } from '../../../src/components/EditTextModal';

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
            language="plaintext"
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
    <EditTextAreaModal
      isOpen={isOpen}
      text={text}
      title="Edit hint"
      setText={setText}
      onSave={onSave}
      onClose={onClose}
    />
  );
};

export default withTeacherLogin(() => {
  const Hint = ({
    text,
    onDelete,
    onEdit,
  }: {
    text: string;
    onDelete: () => void;
    onEdit: () => void;
  }) => {
    return (
      <div className="flex items-stretch justify-between bg-gray-900 divide-x divide-gray-600">
        <div className="px-3 py-2">
          <Markdown>{text}</Markdown>
        </div>
        <div className="space-x-1 px-3 py-2">
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
            <FontAwesomeIcon icon={{ prefix: 'fas', iconName: 'trash' }} />
          </button>
        </div>
      </div>
    );
  };
  const [original, setOriginal] = useState('');
  const [translated, setTranslated] = useState('');
  const [initTranslated, setInitTranslated] = useState('');
  const [platform, setPlatform] = useState<string | null>(null);
  const [problemID, setProblemID] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hints, setHints] = useState<string[]>([]);
  const [hintText, setHintText] = useState('');
  const [onSaveHint, setOnSaveHint] = useState<(text: string) => void>(
    () => (_: string) => {}
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
    const problemDoc = doc(
      getFirestore(),
      'problemsets',
      platform,
      'problems',
      problemID,
      'translations',
      'hu'
    );
    await setDoc(problemDoc, { statement: translated, hints: hints });
    setUnsaved(false);
  };

  const handleAddNewHint = () => {
    setHintText('');
    setOnSaveHint((_: any) => (text: string) => {
      setUnsaved(true);
      setHints(prev => [...prev, text]);
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
        text={hintText}
        setText={setHintText}
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
      <div className="border border-gray-600 bg-gray-800 mt-2 flex flex-col">
        <div className="flex items-center justify-between bg-gray-800 px-3 py-2 border-b border-gray-600 text-sm space-x-2">
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
        <div className="max-h-[16rem] overflow-y-auto divide-y divide-gray-700 text-sm">
          {hints.length === 0 && <div className="bg-gray-900 h-6"></div>}
          {hints.map((hint: string, index: number) => (
            <Hint
              text={hint}
              key={index}
              onDelete={() => {
                setUnsaved(true);
                setHints(prev => {
                  return prev.filter((_, ind) => ind !== index);
                });
              }}
              onEdit={() => {
                setHintText(hint);
                setOnSaveHint(
                  (_: any) => (text: string) =>
                    setHints(prev => {
                      setUnsaved(true);
                      prev[index] = text;
                      return prev;
                    })
                );
                setIsOpen(true);
              }}
            />
          ))}
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
});
