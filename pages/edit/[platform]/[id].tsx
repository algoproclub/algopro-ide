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
import {
  Hint,
  Language,
  Platform,
  ProblemData,
  ProblemTag,
  problemTags,
  Sample,
} from '../../../src/types/problem';
import dynamic from 'next/dynamic';
import HTMLStatement from '../../../src/components/JudgeInterface/HTMLStatement';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { LanguageSelectorDropdown } from '../../../src/components/JudgeInterface/GenericJudgeInterface';
import {
  EditModal,
  handleKeyDown,
} from '../../../src/components/EditTextModal';
import WithAdminLogin from '../../../src/components/WithAdminLogin';
import Dropdown from '../../../src/components/Dropdown';
import Checkbox from '../../../src/components/Checkbox';
import { useUserContext } from '../../../src/context/UserContext';
import PageTitle from '../../../src/components/PageTitle';

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
const translateOpenAI = httpsCallable<
  {
    text: string;
    lang: string;
  },
  string
>(getFunctions(undefined, 'europe-west1'), 'translateOpenAI');

const codeLangs: Language[] = ['cpp', 'py', 'java'];

const cellBorderClass = 'border-x border-[color:var(--border-muted)]';
const iconButtonClass =
  'px-2 py-1 rounded-md hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)]';
const textareaClass =
  'font-mono theme-input border w-full min-h-[10rem] text-sm';
const secondaryButtonClass =
  'theme-button-secondary border rounded-md active:bg-[color:var(--surface-active)]';

function normalizeSamples(samples: unknown): Sample[] {
  if (!Array.isArray(samples)) return [];

  return samples.map(sample => {
    const normalizedSample = sample as Partial<Sample> | null;
    return {
      input:
        typeof normalizedSample?.input === 'string'
          ? normalizedSample.input
          : '',
      output:
        typeof normalizedSample?.output === 'string'
          ? normalizedSample.output
          : '',
    };
  });
}

const SaveStatusIndicator = ({ saved }: { saved: boolean }) => {
  return (
    <div className="flex text-sm space-x-0.5">
      {!saved && (
        <>
          <span className="theme-text-muted">[Unsaved]</span>
          <span className="text-[0.65rem] text-[color:var(--warning)] px-2">
            &#9679;
          </span>
        </>
      )}
      {saved && (
        <>
          <span className="theme-text-muted">[Saved]</span>
          <span className="text-[0.65rem] text-[color:var(--success)] px-2">
            &#9679;
          </span>
        </>
      )}
    </div>
  );
};

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
          active
            ? 'bg-[color:var(--surface-active)]'
            : 'hover:bg-[color:var(--surface-hover)]'
        } text-sm`}
        onClick={onClick}
      >
        {text}
      </button>
    );
  };
  const [mode, setMode] = useState('code');
  const [fullscreen, setFullscreen] = useState(false);
  const {
    userData: { fontSize },
  } = useUserContext();

  return (
    <div
      className={` ${
        fullscreen ? 'fixed flex flex-col inset-0 z-50 !m-0' : 'w-full'
      } border theme-border theme-surface-raised`}
    >
      <div className="flex items-center justify-between w-full px-3 py-2.5 theme-surface-raised border-b theme-border">
        <div className="flex space-x-2 items-center">
          <button
            className="flex items-center justify-center px-2.5 py-2 rounded-md mr-0.5 hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)] border theme-border"
            onClick={() => setFullscreen(value => !value)}
          >
            <FontAwesomeIcon
              className="w-4 h-4 inline"
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
        {!readonly && <SaveStatusIndicator saved={!unsaved} />}
      </div>
      <div
        className={`${fullscreen ? `h-full` : 'h-48 md:h-96'} ${
          mode === 'split' ? 'divide-x divide-[color:var(--border-color)]' : ''
        } relative flex-1`}
      >
        <div
          className={`absolute theme-border ${
            mode === 'preview' ? 'hidden' : ''
          } top-0 left-0 bottom-0 ${
            mode === 'split' ? 'right-1/2' : 'right-0'
          }`}
        >
          {/* The embedded editor intentionally keeps its dark syntax theme. */}
          <CodeEditor
            onChange={onChange}
            value={text}
            language="html"
            theme="dark"
            path={path}
            editorOptions={{
              readOnly: readonly,
              automaticLayout: true,
              fontSize,
            }}
          />
        </div>
        {mode !== 'code' && (
          <div
            className={`absolute top-0 right-0 bottom-0 ${
              mode === 'split' ? 'left-1/2' : 'left-0'
            } px-4 py-2 overflow-scroll theme-surface`}
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
          return {};
        } else {
          return '';
        }
      });
    }
  };

  const checked = typeof hint != 'string';
  const selectedLang = codeLangs[selected];

  return (
    <EditModal<Hint>
      isOpen={isOpen}
      title="Edit hint"
      value={hint}
      onSave={(val: Hint) => {
        onSave(val);
        onClose();
      }}
      onClose={onClose}
      renderEditor={(val, setVal) => {
        const displayText =
          typeof val === 'string' ? val : (val[selectedLang] ?? '');

        return (
          <div className="space-y-2">
            <Dropdown
              items={codeLangs}
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
              className={`${textareaClass} h-60`}
              value={displayText}
              onKeyDown={handleKeyDown}
              onChange={e => {
                const valStr = e.target.value;
                setVal(prev => {
                  if (typeof prev === 'string') {
                    return valStr;
                  } else if (valStr !== '') {
                    return { ...prev, [selectedLang]: valStr };
                  } else {
                    return Object.fromEntries(
                      Object.entries(prev).filter(
                        ([key]) => key !== selectedLang
                      )
                    );
                  }
                });
              }}
            />
          </div>
        );
      }}
    />
  );
};

const EditSampleModal = ({
  isOpen,
  sample,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  sample: Sample;
  onSave: (sample: Sample) => void;
  onClose: () => void;
}) => {
  return (
    <EditModal<Sample>
      isOpen={isOpen}
      title="Edit sample"
      value={sample}
      onSave={(val: Sample) => {
        onSave(val);
        onClose();
      }}
      onClose={onClose}
      renderEditor={(val, setVal) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-sm mb-1">Input</div>
            <textarea
              className={`${textareaClass} h-60`}
              value={val.input}
              onKeyDown={handleKeyDown}
              onChange={e => {
                setVal(prev => ({ ...prev, input: e.target.value }));
              }}
            />
          </div>
          <div>
            <div className="text-sm mb-1">Output</div>
            <textarea
              className={`${textareaClass} h-60`}
              value={val.output}
              onKeyDown={handleKeyDown}
              onChange={e => {
                setVal(prev => ({ ...prev, output: e.target.value }));
              }}
            />
          </div>
        </div>
      )}
    />
  );
};

const RemovableTag = ({
  tag,
  idx,
  setTags,
  setUnsaved,
}: {
  tag: ProblemTag;
  idx: number;
  setTags: React.Dispatch<React.SetStateAction<ProblemTag[]>>;
  setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const removeTag = () => {
    setTags(prevTags => prevTags.filter((_, index) => index !== idx));
    setUnsaved(true);
  };

  return (
    <div className="rounded-md border theme-border theme-surface px-2 py-1 m-1 whitespace-nowrap inline-block">
      {tag}
      <button className={iconButtonClass} onClick={removeTag}>
        <FontAwesomeIcon
          icon={{ prefix: 'fas', iconName: 'trash' }}
          className="w-3.5 h-3.5 inline"
        />
      </button>
    </div>
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
    const isEmpty = (obj: object | string): boolean => {
      if (typeof obj === 'string') {
        return obj.length === 0;
      }
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
                className={`w-10 py-2 px-3 ${cellBorderClass}`}
                rowSpan={rowCount}
              >
                {hintNum}
              </td>
            )}
            {lang !== '' && (
              <td className={`w-16 py-2 px-3 ${cellBorderClass}`}>{lang}</td>
            )}
            <td
              className={`py-2 px-3 ${cellBorderClass} ${
                isEmpty(hint) ? 'theme-text-muted' : ''
              }`}
              colSpan={lang === '' ? 2 : 1}
            >
              {text}
            </td>
            {i === 0 && (
              <td
                className={`space-x-1 px-3 py-2 w-[5.5rem] ${cellBorderClass}`}
                rowSpan={rowCount}
              >
                <div className="flex items-center">
                  <button className={iconButtonClass} onClick={onEdit}>
                    <FontAwesomeIcon
                      icon={{ prefix: 'fas', iconName: 'edit' }}
                      className="w-3.5 h-3.5 inline"
                    />
                  </button>
                  <button className={iconButtonClass} onClick={onDelete}>
                    <FontAwesomeIcon
                      icon={{ prefix: 'fas', iconName: 'trash' }}
                      className="w-3.5 h-3.5 inline"
                    />
                  </button>
                </div>
              </td>
            )}
          </tr>
        ))}
      </>
    );
  };
  const [original, setOriginal] = useState('');
  const [problemTitle, setProblemTitle] = useState<string | null>(null);
  const [translated, setTranslated] = useState('');
  const [initTranslated, setInitTranslated] = useState('');
  const [platform, setPlatform] = useState<string | null>(null);
  const [problemID, setProblemID] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hints, setHints] = useState<Hint[]>([]);
  const [initSolution, setInitSolution] = useState<string>('');
  const [solution, setSolution] = useState<string>('');
  const [editedHint, setEditedHint] = useState<Hint>('');
  const [editedSample, setEditedSample] = useState<Sample>({
    input: '',
    output: '',
  });
  const [tags, setTags] = useState<ProblemTag[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [addedTag, setAddedTag] = useState<string>('');
  const [onSaveHint, setOnSaveHint] = useState<() => (h: Hint) => void>(
    () => _ => {}
  );
  const [onSaveSample, setOnSaveSample] = useState<(s: Sample) => void>(
    () => {}
  );
  const [unsaved, setUnsaved] = useState(false);
  const [unsavedSol, setUnsavedSol] = useState(false);
  const [language, setLanguage] = useState('-');
  const [solutionLanguage, setSolutionLanguage] = useState(0);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
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
        setTags(data?.tags ?? []);
        if (language === '-') {
          setSamples(normalizeSamples(data?.samples));
        }
      })
      .catch(error => {
        console.error(error);
      });
  };
  const getSolution = async (platform: string, id: string): Promise<string> => {
    const snapshot = await getDoc(
      doc(
        getFirestore(),
        `problemsets/${platform}/problems/${id}/solutions/${codeLangs[solutionLanguage]}`
      )
    );
    return snapshot.data()?.content ?? '';
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
    (async () => {
      try {
        const problemData = await getOriginal(platform, problemID);
        setProblemTitle(problemData.title);
        setOriginal(problemData.statement ?? '');
        setSamples(normalizeSamples(problemData.samples));
        setInitSolution(await getSolution(platform, problemID));
        updateTranslated();
      } catch (error) {
        console.error(error);
      }
    })();
  }, [platform, problemID]);

  useEffect(() => {
    if (!platform || !problemID) {
      return;
    }
    (async () => {
      const res = await getSolution(platform, problemID);
      setInitSolution(res);
      setSolution(res);
    })();
  }, [solutionLanguage]);

  useEffect(() => {
    if (!platform || !problemID) {
      return;
    }
    updateTranslated();
  }, [language, original]);

  const handleTranslationChange = useCallback((val: string) => {
    if (translated !== val) {
      setTranslated(val);
    }
  }, []);

  const handleSolutionChange = useCallback((val: string) => {
    if (solution !== val) {
      setSolution(val);
    }
  }, []);

  useEffect(() => {
    setUnsavedSol(solution !== initSolution);
  }, [solution]);

  useEffect(() => {
    setSolution(initSolution);
  }, [initSolution]);

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

    if (language === '-') {
      await updateDoc(problemDoc, {
        statement: translated,
        hints,
        tags,
        samples: normalizeSamples(samples),
      });
    } else {
      await setDoc(problemDoc, {
        statement: translated,
        hints,
      });
    }
    await setDoc(
      doc(
        getFirestore(),
        'problemsets',
        platform,
        'problems',
        problemID,
        'solutions',
        codeLangs[solutionLanguage]
      ),
      {
        content: solution,
        type: codeLangs[solutionLanguage],
      }
    );
    setUnsaved(false);
    setUnsavedSol(false);
  };

  const handleAddNewHint = () => {
    setEditedHint('');
    setOnSaveHint(() => (h: Hint) => {
      setUnsaved(true);
      setHints(prev => [...prev, h]);
    });
    setIsOpen(true);
  };

  const handleAddNewSample = () => {
    setEditedSample({ input: '', output: '' });
    setOnSaveSample(() => (sample: Sample) => {
      setUnsaved(true);
      setSamples(prev => [...prev, sample]);
    });
    setIsSampleModalOpen(true);
  };

  const handleAutoTranslateDeepl = async () => {
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

  const handleAutoTranslateOpenAI = async () => {
    const response = await translateOpenAI({
      text: original,
      lang: language,
    });
    if (response.data !== null) {
      setTranslated(response.data);
    } else {
      console.error('unsuccessful translation');
    }
  };

  const handleKeyDownTagInput = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Enter') {
      if (addedTag.trim() !== '' && filteredOptions.length > 0) {
        if (tags.includes(filteredOptions[0].trim())) {
          alert(`Problem already has "${filteredOptions[0].trim()}" tag.`);
        } else {
          setTags([...tags, filteredOptions[0].trim()]);
          setAddedTag('');
          setUnsaved(true);
        }
      } else {
        alert(`Invalid problem tag "${addedTag}".`);
      }
    }
  };

  const filteredOptions = problemTags.filter(
    option =>
      option.toLowerCase().includes(addedTag.toLowerCase()) &&
      !tags.includes(option.toLowerCase())
  );

  return (
    <div className="p-3 theme-page max-w-[1440px] mx-auto">
      <PageTitle>
        {problemTitle ? `Edit: ${problemTitle} (${problemID})` : undefined}
      </PageTitle>
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
      <div className="mb-4 space-x-2 text-[0.95rem]">
        <button
          className={`${secondaryButtonClass} px-4 py-2`}
          onClick={handleAutoTranslateDeepl}
        >
          Auto translate (Deepl)
        </button>
        <button
          className={`${secondaryButtonClass} px-4 py-2`}
          onClick={handleAutoTranslateOpenAI}
        >
          Auto translate (OpenAI)
        </button>
        <button
          className="px-4 py-2 rounded-md theme-button-primary"
          onClick={handleSave}
        >
          Save
        </button>
      </div>
      <EditHintModal
        isOpen={isOpen}
        hint={editedHint}
        setHint={setEditedHint}
        onSave={onSaveHint}
        onClose={() => setIsOpen(false)}
      />
      <EditSampleModal
        isOpen={isSampleModalOpen}
        sample={editedSample}
        onSave={onSaveSample}
        onClose={() => setIsSampleModalOpen(false)}
      />
      <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
        <HTMLEditor path="original" readonly={true} text={original} />
        <HTMLEditor
          path="translated"
          readonly={false}
          text={translated}
          onChange={handleTranslationChange}
          unsaved={unsaved}
        />
      </div>
      <div className="theme-surface-raised mt-2 flex flex-col">
        <div className="border theme-border flex items-center justify-between theme-surface-raised px-3 py-2 border-b text-sm space-x-2">
          <span className="font-bold">Hints</span>
          <button
            className={`${secondaryButtonClass} px-2 py-1 flex items-center`}
            onClick={handleAddNewHint}
          >
            New
            <FontAwesomeIcon
              icon={{ prefix: 'fas', iconName: 'plus' }}
              className="ml-2 w-4 h-4 inline"
            />
          </button>
        </div>
        <div className="max-h-[16rem] border-b theme-border overflow-auto">
          <table className="text-sm theme-table border-collapse w-full">
            <tbody className="divide-y divide-[color:var(--border-muted)]">
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
      {language === '-' && (
        <div className="theme-surface-raised mt-2 flex flex-col">
          <div className="border theme-border flex items-center justify-between theme-surface-raised px-3 py-2 border-b text-sm space-x-2">
            <span className="font-bold">Samples</span>
            <button
              className={`${secondaryButtonClass} px-2 py-1 flex items-center`}
              onClick={handleAddNewSample}
            >
              New
              <FontAwesomeIcon
                icon={{ prefix: 'fas', iconName: 'plus' }}
                className="ml-2 w-4 h-4 inline"
              />
            </button>
          </div>
          <div className="max-h-[16rem] border-b theme-border overflow-auto">
            <table className="text-sm theme-table border-collapse w-full">
              <tbody className="divide-y divide-[color:var(--border-muted)]">
                {samples.map((sample, index) => (
                  <tr key={index}>
                    <td
                      className={`w-10 py-2 px-3 ${cellBorderClass} align-top`}
                    >
                      {index + 1}
                    </td>
                    <td
                      className={`w-1/2 py-2 px-3 ${cellBorderClass} align-top`}
                    >
                      <div className="text-xs theme-text-muted mb-1">Input</div>
                      <pre className="whitespace-pre-wrap font-mono text-sm">
                        {sample.input || (
                          <span className="text-[color:var(--text-disabled)]">
                            No input specified
                          </span>
                        )}
                      </pre>
                    </td>
                    <td
                      className={`w-1/2 py-2 px-3 ${cellBorderClass} align-top`}
                    >
                      <div className="text-xs theme-text-muted mb-1">
                        Output
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-sm">
                        {sample.output || (
                          <span className="text-[color:var(--text-disabled)]">
                            No output specified
                          </span>
                        )}
                      </pre>
                    </td>
                    <td
                      className={`space-x-1 px-3 py-2 w-[5.5rem] ${cellBorderClass} align-top`}
                    >
                      <div className="flex items-center">
                        <button
                          className={iconButtonClass}
                          onClick={() => {
                            setEditedSample(sample);
                            setOnSaveSample(() => (nextSample: Sample) => {
                              setUnsaved(true);
                              setSamples(prev =>
                                prev.map((currentSample, currentIndex) =>
                                  currentIndex === index
                                    ? nextSample
                                    : currentSample
                                )
                              );
                            });
                            setIsSampleModalOpen(true);
                          }}
                        >
                          <FontAwesomeIcon
                            icon={{ prefix: 'fas', iconName: 'edit' }}
                            className="w-3.5 h-3.5 inline"
                          />
                        </button>
                        <button
                          className={iconButtonClass}
                          onClick={() => {
                            if (
                              confirm(
                                'The sample will be deleted. Do you want to proceed?'
                              )
                            ) {
                              setUnsaved(true);
                              setSamples(prev =>
                                prev.filter(
                                  (_, sampleIndex) => sampleIndex !== index
                                )
                              );
                            }
                          }}
                        >
                          <FontAwesomeIcon
                            icon={{ prefix: 'fas', iconName: 'trash' }}
                            className="w-3.5 h-3.5 inline"
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="mt-2 p-4 theme-surface-raised border theme-border">
        <div className="w-full flex justify-between mb-1.5">
          <span className="font-semibold text-sm inline-block">Solutions</span>
          <SaveStatusIndicator saved={!unsavedSol} />
        </div>
        <Dropdown
          items={codeLangs}
          selected={solutionLanguage}
          setSelected={num => {
            if (
              !unsavedSol ||
              confirm(
                'The unsaved changes will be lost. Do you want to proceed?'
              )
            ) {
              setSolutionLanguage(num);
              setUnsavedSol(false);
            }
          }}
        />
        <div className="mt-2 border theme-border h-48">
          {/* The solution editor intentionally keeps its dark syntax theme. */}
          <CodeEditor
            value={solution}
            theme="dark"
            onChange={handleSolutionChange}
            language={
              { cpp: 'cpp', py: 'python', java: 'java' }[
                codeLangs[solutionLanguage]
              ]
            }
          />
        </div>
      </div>

      {language === '-' && (
        <div className="max-h-[16rem] border theme-border theme-surface-raised mt-2 overflow-y-auto">
          <table className="text-sm theme-table border-collapse w-full">
            <tbody className="divide-y divide-[color:var(--border-muted)] h-[3.5rem]">
              <tr>
                <td
                  className={`py-2 px-3 w-[3.0rem] ${cellBorderClass} theme-table-header font-bold`}
                >
                  Tags
                </td>
                <td className={`py-1 px-3 ${cellBorderClass}`}>
                  {tags.map((item, index) => (
                    <RemovableTag
                      tag={item}
                      idx={index}
                      setTags={setTags}
                      setUnsaved={setUnsaved}
                      key={item}
                    />
                  ))}
                </td>
                <td
                  className={`space-x-1 px-3 py-1.5 w-[5.5rem] ${cellBorderClass} theme-table-header`}
                >
                  <input
                    type="text"
                    placeholder="New tag"
                    className="font-mono theme-input border h-8 resize-none p-2 rounded text-sm"
                    value={addedTag}
                    onChange={e => setAddedTag(e.target.value)}
                    onKeyDown={handleKeyDownTagInput}
                  />
                  {addedTag.trim() && (
                    <ul className="border theme-border rounded-md theme-surface absolute m-0.5">
                      {filteredOptions.length > 0 &&
                        filteredOptions.map((option, index) => (
                          <li
                            className="px-3 py-2 hover:bg-[color:var(--surface-hover)] active:bg-[color:var(--surface-active)]"
                            key={index}
                            onClick={() => {
                              if (tags.includes(option.trim())) {
                                alert(`Problem already has "${option}" tag.`);
                              } else {
                                setTags([...tags, option.trim()]);
                                setUnsaved(true);
                                setAddedTag('');
                              }
                            }}
                          >
                            {option}
                          </li>
                        ))}
                    </ul>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default function EditPage() {
  return (
    <WithAdminLogin>
      <PageContent />
    </WithAdminLogin>
  );
}
