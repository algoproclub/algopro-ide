import dynamic from 'next/dynamic';

export default dynamic(() => import('./ProfileSettings'), {
  loading: () => null,
  ssr: false,
});
