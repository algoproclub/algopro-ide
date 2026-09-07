import dynamic from 'next/dynamic';
import React from 'react';
import { RealtimeEditorProps } from './RealtimeEditor';

const Editor = dynamic(() => import('./RealtimeEditor'), {
  loading: () => <div className="px-4 py-3" />,
  ssr: false,
});

export const LazyRealtimeEditor = (props: RealtimeEditorProps): JSX.Element => {
  return <Editor {...props} />;
};
