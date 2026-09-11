import React from 'react';
import {
  connectAutoComplete,
  Highlight,
  InstantSearch,
  PoweredBy,
} from 'react-instantsearch-dom';
import algoliasearch from 'algoliasearch/lite';

const searchClient = algoliasearch(
  '3CFULMFIDW',
  'b1b046e97b39abe6c905e0ad1df08d9e'
);

const indexName = 'usacoProblems';

const usePoweredByTheme = (): 'light' | 'dark' => {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');

  React.useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => {
      setTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
};

const FileSearch = ({
  hits,
  currentRefinement,
  refine,
  onSelect,
  canChange,
}: {
  hits: any[];
  currentRefinement: string;
  refine: (arg: string) => void;
  onSelect: (arg: any) => void;
  canChange: boolean;
}) => {
  const poweredByTheme = usePoweredByTheme();

  return (
    <div>
      <div className="flex items-center relative">
        <input
          type="search"
          name={`problem-select`}
          id={`problem-select`}
          className="mt-0 block w-full border-0 border-b-2 border-line bg-transparent px-0 pb-1 pt-0 text-sm text-content focus:border-line-strong focus:ring-0"
          value={currentRefinement}
          placeholder={'e.g. Train Scheduling'}
          onChange={e => refine(e.target.value)}
          // disabled={!canChange}
          autoComplete="off"
          autoFocus
          disabled={!canChange}
        />
      </div>
      {currentRefinement !== '' && (
        <div>
          <div className="max-h-[20rem] divide-y divide-line-muted overflow-y-auto border-t border-line text-sm">
            {hits.map(hit => (
              <button
                className="block w-full px-5 py-3 text-left transition hover:bg-surface-hover focus:outline-none"
                key={hit.id}
                onClick={() => {
                  refine(''); // clear
                  onSelect(hit);
                }}
              >
                <h3 className="theme-text font-medium">
                  <Highlight hit={hit} attribute="title" /> (
                  <Highlight hit={hit} attribute="id" />)
                </h3>
                <p className="theme-text-muted text-sm">
                  <Highlight hit={hit} attribute="source" />
                </p>
              </button>
            ))}
          </div>
          <div className="px-5 py-3 border-t theme-border">
            <PoweredBy theme={poweredByTheme} />
          </div>
        </div>
      )}
    </div>
  );
};

const ConnectedSearch = connectAutoComplete(FileSearch);

const ProblemSearchInterface: React.FC<{
  onSelect: (hit: any) => void;
  canChange: boolean;
}> = ({ onSelect, canChange }) => {
  return (
    // @ts-ignore -- react instantsearch hooks was released and we should upgrade to that anyway
    <InstantSearch indexName={indexName} searchClient={searchClient}>
      <ConnectedSearch onSelect={onSelect} canChange={canChange} />
    </InstantSearch>
  );
};

export default ProblemSearchInterface;
