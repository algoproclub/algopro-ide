import dynamic from 'next/dynamic';
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const LazyMonacoEditor = dynamic(() => import('./MonacoEditor'), {
  loading: () => (
    <div className="px-4 py-3" data-testid="editorLoadingMessage">
      <FontAwesomeIcon
        icon={{ prefix: 'fas', iconName: 'spinner' }}
        className="mr-2 w-5 h-5 animate-spin-slow text-indigo-500"
      />
      Loading...
    </div>
  ),
  ssr: false,
});

export default LazyMonacoEditor;
