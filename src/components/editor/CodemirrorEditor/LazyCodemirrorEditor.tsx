import dynamic from 'next/dynamic';
import React from 'react';
import LoadingIndicator from '../../LoadingIndicator';

const LazyCodemirrorEditor = dynamic(() => import('./CodemirrorEditor'), {
  loading: () => (
    <div
      className="px-4 py-3 flex items-center justify-between"
      data-testid="editorLoadingMessage"
    >
      <LoadingIndicator className="mr-2 h-4 w-4 text-content-muted" />
      <span className="text-content-muted">Loading…</span>
    </div>
  ),
  ssr: false,
});

export default LazyCodemirrorEditor;
