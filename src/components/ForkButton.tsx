import { DocumentDuplicateIcon } from '@heroicons/react/20/solid';
import React from 'react';
import { useEditorContext } from '../context/EditorContext';

export const ForkButton = (): JSX.Element => {
  const { fileData } = useEditorContext();

  return (
    <a
      // szda re-theme phase2: clone link follows shared text hover tokens.
      className="relative inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] focus:outline-none"
      href={`/${fileData.id.substring(1)}/copy`}
      target="_blank"
      rel="noreferrer"
    >
      <DocumentDuplicateIcon
        className="-ml-1 mr-2 h-5 w-5 text-[color:var(--text-secondary)]"
        aria-hidden="true"
      />
      Clone File
    </a>
  );
};
