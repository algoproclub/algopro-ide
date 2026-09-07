import dynamic from 'next/dynamic';
import React from 'react';
import LoadingIndicator from '../../LoadingIndicator';

const LazyMonacoEditor = dynamic(() => import('./MonacoEditor'), {
  loading: () => (
    <div className="px-4 py-3 flex" data-testid="editorLoadingMessage">
      <div className="flex items-center justify-between">
        <LoadingIndicator className="mr-2 h-4 w-4 text-content-muted" />
        <span className="text-content-muted">Loading…</span>
      </div>
    </div>
  ),
  ssr: false,
});

export default LazyMonacoEditor;
