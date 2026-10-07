import { Menu } from '@headlessui/react';
import {
  ChevronDownIcon,
  CogIcon,
  PlusIcon,
  ArrowDownTrayIcon,
  ClipboardIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/solid';
import React, { useState } from 'react';

import { mainEditorHandleAtom } from '../../atoms/workspace';
import { useAtomValue } from 'jotai';
import { useEditorContext } from '../../context/EditorContext';
import download from '../../scripts/download';
import { extractJavaFilename } from '../../scripts/runCode';
import useUserPermission from '../../hooks/useUserPermission';
import { useUserContext } from '../../context/UserContext';
import { problemAtom } from '../../atoms/workspaceUI';
import {
  AnchoredMenuItems,
  anchoredMenuIconClass,
  getAnchoredMenuItemClass,
} from '../AnchoredMenuItems';

export const FileMenu = (props: {
  onOpenSettings: () => void;
}): JSX.Element => {
  const { fileData } = useEditorContext();
  const problem = useAtomValue(problemAtom);
  const mainEditorHandle = useAtomValue(mainEditorHandleAtom);
  const permission = useUserPermission();
  const { templateCode } = useUserContext();

  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(
    null
  );
  const canWrite = permission === 'OWNER' || permission === 'READ_WRITE';

  /* ======= BEGIN DROPDOWN ACTIONS ======= */
  const handleDownloadFile = () => {
    if (!mainEditorHandle) {
      alert("Editor hasn't loaded yet. Please wait.");
      return;
    }

    const code = mainEditorHandle.getValue();

    const fileNames = {
      cpp: `${fileData.settings.workspaceName}.cpp`,
      java: extractJavaFilename(code),
      py: `${fileData.settings.workspaceName}.py`,
    };

    download(fileNames[fileData.settings.language], code);
  };

  const handleCopyCode = () => {
    if (!mainEditorHandle) {
      alert("Editor hasn't loaded yet. Please wait.");
      return;
    }

    const code = mainEditorHandle.getValue();
    navigator.clipboard.writeText(code).catch(err => {
      console.error('Failed to copy text to clipboard:', err);
      alert('Failed to copy text to clipboard. Please try again.');
    });
  };

  const handleInsertFileTemplate = () => {
    if (!mainEditorHandle) {
      alert("Editor hasn't loaded yet, please wait");
      return;
    }
    if (confirm('Reset current file? Any changes you made will be lost.')) {
      const lang = fileData.settings.language;
      const text = problem?.templateCode?.[lang] ?? templateCode[lang];
      mainEditorHandle.setValue(text);
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

          <AnchoredMenuItems
            anchor={referenceElement}
            className="w-56"
            menuClassName="origin-top-left"
            open={open}
            placement="bottom-start"
          >
            <div className="py-1">
              <Menu.Item>
                {({ active }) => (
                  <a
                    href="/new"
                    target="_blank"
                    className={getAnchoredMenuItemClass(active)}
                  >
                    <PlusIcon
                      className={anchoredMenuIconClass}
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
                    className={getAnchoredMenuItemClass(active)}
                    onClick={handleDownloadFile}
                  >
                    <ArrowDownTrayIcon
                      className={anchoredMenuIconClass}
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
                    className={getAnchoredMenuItemClass(active)}
                    onClick={handleCopyCode}
                  >
                    <ClipboardIcon
                      className={anchoredMenuIconClass}
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
                    className={getAnchoredMenuItemClass(active)}
                  >
                    <DocumentDuplicateIcon
                      className={anchoredMenuIconClass}
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
                      className={getAnchoredMenuItemClass(active)}
                      onClick={handleInsertFileTemplate}
                    >
                      <ArrowPathIcon
                        className={anchoredMenuIconClass}
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
                    className={getAnchoredMenuItemClass(active)}
                    onClick={() => props.onOpenSettings()}
                  >
                    <CogIcon
                      className={anchoredMenuIconClass}
                      aria-hidden="true"
                    />
                    Workspace Settings
                  </button>
                )}
              </Menu.Item>
            </div>
          </AnchoredMenuItems>
        </>
      )}
    </Menu>
  );
};
