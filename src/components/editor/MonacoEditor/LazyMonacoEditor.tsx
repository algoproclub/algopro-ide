import dynamic from 'next/dynamic';
import React from 'react';

const LazyMonacoEditor = dynamic(() => import('./MonacoEditor'), {
  loading: () => <div className="p-2" data-testid="editorLoadingMessage">Loading...</div>,
  ssr: false,
});

export default LazyMonacoEditor;
