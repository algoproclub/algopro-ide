import dynamic from 'next/dynamic';
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import LoadingIndicator from '../../LoadingIndicator';

const LazyMonacoEditor = dynamic(() => import('./MonacoEditor'), {
  loading: () => (
    <div className="px-4 py-3 flex" data-testid="editorLoadingMessage">
      <div className="flex items-center justify-between">
        <LoadingIndicator className="h-4 w-4 mr-2 text-indigo-500" />
        <span>Loading...</span>
      </div>
    </div>
  ),
  ssr: false,
});

export default LazyMonacoEditor;
