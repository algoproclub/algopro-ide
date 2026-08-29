import { Menu, Transition } from '@headlessui/react';
import {
  ChevronDownIcon,
  CogIcon,
  PlusIcon,
  ArrowDownTrayIcon,
  ClipboardIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/20/solid';
import React, { Fragment, useState, useEffect } from 'react';
import classNames from 'classnames';
import ReactDOM from 'react-dom';
import { usePopper } from 'react-popper';

import {
  mainCodemirrorEditorAtom,
  mainEditorValueAtom,
  mainMonacoEditorAtom,
} from '../../atoms/workspace';
import { useAtomValue } from 'jotai';
import { useEditorContext } from '../../context/EditorContext';
import download from '../../scripts/download';
import { extractJavaFilename } from '../../scripts/runCode';
import useUserPermission from '../../hooks/useUserPermission';
import { useUserContext } from '../../context/UserContext';
import { problemAtom } from '../../atoms/workspaceUI';

export const FileMenu = (props: {
  onOpenSettings: () => void;
}): JSX.Element => {
  const { fileData } = useEditorContext();
  const problem = useAtomValue(problemAtom);
  const getMainEditorValue = useAtomValue(mainEditorValueAtom);
  const mainMonacoEditor = useAtomValue(mainMonacoEditorAtom);
  const mainCodemirrorEditor = useAtomValue(mainCodemirrorEditorAtom);
  const permission = useUserPermission();
  const { templateCode } = useUserContext();

  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null
  );
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'bottom-start',
    modifiers: [{ name: 'offset', options: { offset: [0, 6] } }],
  });
  const canWrite = permission === 'OWNER' || permission === 'READ_WRITE';

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const menuItemClass = (active: boolean) =>
    classNames(
      active ? 'bg-surface-hover text-content' : 'text-content',
      'ui-menu-item group py-1.5'
    );
  const menuIconClass =
    'mr-2.5 h-4 w-4 text-content-muted group-hover:text-content';

  /* ======= BEGIN DROPDOWN ACTIONS ======= */
  const handleDownloadFile = () => {
    if (!getMainEditorValue) {
      alert("Editor hasn't loaded yet. Please wait.");
      return;
    }

    const code = getMainEditorValue();

    const fileNames = {
      cpp: `${fileData.settings.workspaceName}.cpp`,
      java: extractJavaFilename(code),
      py: `${fileData.settings.workspaceName}.py`,
    };

    download(fileNames[fileData.settings.language], code);
  };

  const handleCopyCode = () => {
    if (!getMainEditorValue) {
      alert("Editor hasn't loaded yet. Please wait.");
      return;
    }

    const code = getMainEditorValue();
    navigator.clipboard.writeText(code).catch(err => {
      console.error('Failed to copy text to clipboard:', err);
      alert('Failed to copy text to clipboard. Please try again.');
    });
  };

  const handleInsertFileTemplate = () => {
    if (!mainMonacoEditor && !mainCodemirrorEditor) {
      alert("Editor hasn't loaded yet, please wait");
      return;
    }
    if (confirm('Reset current file? Any changes you made will be lost.')) {
      const lang = fileData.settings.language;
      const text = problem?.templateCode?.[lang] ?? templateCode[lang];
      if (mainMonacoEditor) mainMonacoEditor.setValue(text);
      else if (mainCodemirrorEditor) {
        mainCodemirrorEditor.dispatch({
          changes: {
            from: 0,
            to: mainCodemirrorEditor.state.doc.length,
            insert: text,
          },
        });
      } else {
        console.error(
          "?? shouldn't happen, both monaco and codemirror editors are not defined"
        );
      }
    }
  };

  const forkButtonURL = `/${fileData.id.substring(1)}/copy`;
  /* ======= END DROPDOWN ACTIONS ======= */

  return (
    <Menu as="div" className="relative inline-block text-left">
      {({ open }) => (
        <>
          <div>
            <Menu.Button
              className={`workspace-toolbar-button ${
                open ? 'border-line-strong bg-surface-active' : ''
              }`}
              ref={setReferenceElement}
            >
              File
              <ChevronDownIcon
                className="h-4 w-4 text-content-muted"
                aria-hidden="true"
              />
            </Menu.Button>
          </div>

          <Transition show={open}>
            {mounted
              ? ReactDOM.createPortal(
                  <Menu.Items static as="div">
                    <div
                      ref={setPopperElement}
                      style={styles.popper}
                      {...attributes.popper}
                      className="relative"
                    >
                      <Transition.Child
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <div className="ui-menu absolute left-0 z-10 w-56 origin-top-left">
                          <div className="py-1">
                            <Menu.Item>
                              {({ active }) => (
                                <a
                                  href="/new"
                                  target="_blank"
                                  className={menuItemClass(active)}
                                >
                                  <PlusIcon
                                    className={menuIconClass}
                                    aria-hidden="true"
                                  />
                                  New File
                                </a>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  type="button"
                                  className={menuItemClass(active)}
                                  onClick={handleDownloadFile}
                                >
                                  <ArrowDownTrayIcon
                                    className={menuIconClass}
                                    aria-hidden="true"
                                  />
                                  Download File
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  type="button"
                                  className={menuItemClass(active)}
                                  onClick={handleCopyCode}
                                >
                                  <ClipboardIcon
                                    className={menuIconClass}
                                    aria-hidden="true"
                                  />
                                  Copy Code
                                </button>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <a
                                  href={forkButtonURL}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={menuItemClass(active)}
                                >
                                  <DocumentDuplicateIcon
                                    className={menuIconClass}
                                    aria-hidden="true"
                                  />
                                  Clone File
                                </a>
                              )}
                            </Menu.Item>
                            {canWrite && (
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    type="button"
                                    className={menuItemClass(active)}
                                    onClick={handleInsertFileTemplate}
                                  >
                                    <ArrowPathIcon
                                      className={menuIconClass}
                                      aria-hidden="true"
                                    />
                                    Reset File to Template
                                  </button>
                                )}
                              </Menu.Item>
                            )}
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  type="button"
                                  className={menuItemClass(active)}
                                  onClick={() => props.onOpenSettings()}
                                >
                                  <CogIcon
                                    className={menuIconClass}
                                    aria-hidden="true"
                                  />
                                  Workspace Settings
                                </button>
                              )}
                            </Menu.Item>
                          </div>
                        </div>
                      </Transition.Child>
                    </div>
                  </Menu.Items>,
                  document.body
                )
              : null}
          </Transition>
        </>
      )}
    </Menu>
  );
};
