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
import { doc, setDoc, getFirestore, getDoc } from 'firebase/firestore';
import { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import { Platform, ProblemData } from '../../../src/types/problem';
import Markdown from '../../../src/components/JudgeInterface/Markdown';
import dynamic from 'next/dynamic';
import { XMarkIcon } from '@heroicons/react/24/outline';
import HTMLStatement from '../../../src/components/JudgeInterface/HTMLStatement';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { TranslationData } from '../../../functions/src/types';
import withTeacherLogin from '../../../src/scripts/withTeacherLogin';

const FontAwesomeIcon = dynamic<FontAwesomeIconProps>(
  () =>
    import('@fortawesome/react-fontawesome').then(mod => mod.FontAwesomeIcon),
  {
    ssr: false,
  }
);

const translate = httpsCallable<string, string>(
  getFunctions(undefined, 'europe-west1'),
  'translate'
);

const updateTranslation = httpsCallable<TranslationData, boolean>(
  getFunctions(undefined, 'europe-west1'),
  'updatetranslation'
);

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
            theme="vs-dark"
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
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = event => {
    if (event.key === 'Tab') {
      event.preventDefault();

      const textarea = event.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      textarea.value =
        textarea.value.substring(0, start) +
        '\t' +
        textarea.value.substring(end);
      textarea.setSelectionRange(start + '\t'.length, start + '\t'.length);
    }
  };
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        static
        className="fixed z-10 inset-0 overflow-y-auto"
        open={isOpen}
        onClose={onClose}
      >
        <div className="flex items-end justify-center min-h-full pt-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="inline-block bg-gray-900 border border-gray-700 text-white md:rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-2xl w-full">
              <div className="px-4 sm:px-6 pt-4 pb-2">
                <Dialog.Title
                  as="h3"
                  className="text-lg leading-6 font-medium text-center"
                >
                  Edit hint
                </Dialog.Title>
              </div>
              <div className="p-4 sm:p-6 space-y-6">
                <textarea
                  className="font-mono h-60 bg-gray-800 border-gray-700 w-full min-h-[10rem] text-sm"
                  value={text}
                  onKeyDown={handleKeyDown}
                  onChange={e => setText(e.target.value)}
                />
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-gray-700 shadow-sm text-[0.92rem] font-medium rounded-md text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onClick={() => {
                      onSave(text);
                      onClose();
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="rounded-md text-gray-200 hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onClick={onClose}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
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
  const [platform, setPlatform] = useState<string | null>(null);
  const [problemID, setProblemID] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hints, setHints] = useState<string[]>([]);
  const [hintText, setHintText] = useState('');
  const [onSaveHint, setOnSaveHint] = useState<(text: string) => void>(
    () => (_: string) => {}
  );
  const [unsaved, setUnsaved] = useState(false);
  const router = useRouter();

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
    const getTranslated = async (platform: string, id: string) => {
      const problemRef = doc(
        getFirestore(),
        'problemsets',
        platform,
        'problems',
        id,
        'translations',
        'hu'
      );
      const translation = await getDoc(problemRef);
      return translation.data();
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
    getTranslated(platform, problemID)
      .then(data => {
        setTranslated(data?.statement ?? '');
        setHints(data?.hints ?? []);
      })
      .catch(error => {
        console.error(error);
      });
  }, [platform, problemID]);

  const handleChange = useCallback((val: string) => {
    setTranslated(val);
    setUnsaved(true);
  }, []);

  const handleSave = () => {
    if (!platform || !problemID) {
      return;
    }
    updateTranslation({
      problem: {
        platform: platform as Platform,
        id: problemID,
      },
      translation: {
        statement: translated,
        hints: hints,
      },
    }).then(result => {
      if (result.data) {
        setUnsaved(false);
      }
    });
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
    const response = await translate(original);
    setTranslated(response.data);
  };

  return (
    <div className="p-3 text-white max-w-[1440px] mx-auto">
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
