import React from 'react';
import { Language, LANGUAGES } from '../../context/UserContext';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpIcon } from '@heroicons/react/20/solid';
import LazyCodeMirrorEditor from '../editor/CodemirrorEditor/LazyCodemirrorEditor';
import defaultCode from '../../scripts/defaultCode';

export default function TemplateCodeSettings({
  templateCode,
  setTemplateCode,
  language,
  setLanguage,
}: {
  templateCode: Partial<Record<Language, string>>;
  setTemplateCode: (defaults: Partial<Record<Language, string>>) => void;
  language: Language;
  setLanguage: (language: Language) => void;
}): JSX.Element {
  return (
    <div>
      <Listbox value={language} onChange={setLanguage}>
        {({ open }) => (
          <div className="flex flex-row items-center mb-4">
            <Listbox.Label className="text-[0.92rem] block mb-1 text-gray-700 w-auto pr-4">
              Language:
            </Listbox.Label>

            <div className="w-[10rem] flex space-x-2">
              <div className="w-full text-sm relative z-20">
                <Listbox.Button
                  className={`w-full px-3.5 py-2 flex items-center justify-between truncate rounded-md border-2 text-gray-800 ${
                    open
                      ? 'ring-2 ring-indigo-500 border-transparent bg-gray-50'
                      : 'bg-white hover:bg-gray-50 active:bg-gray-50 border-gray-200'
                  }`}
                >
                  <span>
                    {LANGUAGES.find(x => x.value === language)!.label}
                  </span>
                  <ChevronUpIcon
                    className={`h-5 w-5 inline ml-2 ${
                      open ? '' : 'rotate-180'
                    } transition duration-200`}
                  />
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
                    className="z-20 border border-gray-400 rounded-md bg-white divide-y divide-gray-300 absolute top-2 w-full cursor-pointer overflow-hidden"
                  >
                    {LANGUAGES.map(val => (
                      <Listbox.Option
                        className="px-3 py-2 hover:bg-gray-50 active:bg-gray-100 select-none text-gray-800"
                        value={val.value}
                        key={val.value}
                      >
                        {val.label}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </div>
          </div>
        )}
      </Listbox>
      {/* FIXME: This here is a huge hack:
       *
       * - The monaco component uses a bunch of global state (LSP, color scheme),
       *   so creating this editor would mess with the main editor.
       * - We can't add a *different* model to the editor when changing languages,
       *   only replace `value`, so undo/redo history is shared between languages.
       * - We could create a new editor instance when changing languages, but that
       *   still wouldn't solve the undo/redo issue, and the UI would flash when
       *   a new editor is rendered.
       */}
      <div className="h-[18em] sm:h-50vh border-2 border-gray-200 focus:border-black">
        <LazyCodeMirrorEditor
          theme="light"
          language={{ cpp: 'cpp', java: 'java', py: 'python' }[language]}
          onChange={value =>
            setTemplateCode({ ...templateCode, [language]: value })
          }
          value={templateCode[language]}
          saveViewState={false}
          options={{
            minimap: { enabled: false },
            readOnly: false,
            automaticLayout: false,
            insertSpaces: true,
          }}
        />
      </div>
      <div className="flex justify-end flex-row pt-4">
        <button
          type="button"
          className="px-4 py-2 border border-red-700 shadow-sm text-sm font-medium rounded-md text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          onClick={() => {
            setTemplateCode({
              ...templateCode,
              [language]: defaultCode[language],
            });
          }}
        >
          Reset to default
        </button>
      </div>
      <hr className="border-gray-200 mt-4 mb-2" />
    </div>
  );
}
