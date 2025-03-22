import dynamic from 'next/dynamic';
import React from 'react';
import { RealtimeEditorProps } from './RealtimeEditor';
/* import LoadingIndicator from '../LoadingIndicator'; */

const Editor = dynamic(() => import('./RealtimeEditor'), {
  loading: () => (
    <div className="px-4 py-3">
      {/*<LoadingIndicator className="h-4 w-4 mr-2 text-indigo-500" />
      <span>Loading...</span>*/}
    </div>
  ),
  ssr: false,
});

export const LazyRealtimeEditor = (props: RealtimeEditorProps): JSX.Element => {
  return <Editor {...props} />;
};
