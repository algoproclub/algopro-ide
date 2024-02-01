import dynamic from 'next/dynamic';
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import LoadingIndicator from '../../LoadingIndicator';

const LazyCodemirrorEditor = dynamic(() => import('./CodemirrorEditor'), {
  loading: () => (
    <div
      className="px-4 py-3 flex items-center justify-between"
      data-testid="editorLoadingMessage"
    >
      <LoadingIndicator className="h-4 w-4 mr-2 text-indigo-500" />
      <span>Loading...</span>
    </div>
  ),
  ssr: false,
});

export default LazyCodemirrorEditor;
