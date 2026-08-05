import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
} from 'firebase/firestore';
import { atom } from 'jotai';
import { get as getCachedValue, set as setCachedValue } from 'idb-keyval';
import Fuse, { type FuseIndex, type IFuseOptions } from 'fuse.js';
import {
  platforms,
  type Platform,
  type ProblemTag,
  type TagProblem,
} from '../types/problem';

export type LibraryProblem = {
  key: string;
  id: string;
  platform: Platform;
  title: string;
  url: string;
  tags: ProblemTag[];
};

const firestore = getFirestore();
const cacheKey = 'algopro.problem-library.v1';
const cacheRevisionKey = `${cacheKey}.revision`;
const problemLibraryMetadata = doc(firestore, 'metadata', 'problemLibrary');

const problemLibrarySearchKeys = ['title', 'id', 'platform', 'tags'];
const problemLibrarySearchOptions: IFuseOptions<LibraryProblem> = {
  keys: problemLibrarySearchKeys,
  threshold: 0.35,
  ignoreLocation: true,
};

type CachedProblemLibrary = {
  revision: number | null;
  problems: LibraryProblem[];
  index: ReturnType<FuseIndex<LibraryProblem>['toJSON']>;
};

const readCachedRevision = (): number | null => {
  if (typeof window === 'undefined') return null;

  try {
    const revision = JSON.parse(
      localStorage.getItem(cacheRevisionKey) ?? 'null'
    );
    return typeof revision === 'number' ? revision : null;
  } catch {
    return null;
  }
};

const readCachedProblemLibrary =
  async (): Promise<CachedProblemLibrary | null> => {
    if (typeof window === 'undefined') return null;

    try {
      const cached = await getCachedValue<CachedProblemLibrary>(cacheKey);
      return cached &&
        Array.isArray(cached.problems) &&
        Array.isArray(cached.index?.keys) &&
        Array.isArray(cached.index?.records)
        ? cached
        : null;
    } catch {
      return null;
    }
  };

const cacheProblemLibrary = async (cached: CachedProblemLibrary) => {
  if (typeof window === 'undefined') return;

  try {
    await setCachedValue(cacheKey, cached);
    localStorage.setItem(cacheRevisionKey, JSON.stringify(cached.revision));
  } catch {
    // The library remains available in the atom cache if browser storage fails.
  }
};

const fetchProblemLibraryRevision = async (): Promise<number | null> => {
  try {
    const metadata = await getDoc(problemLibraryMetadata);
    const revision = metadata.data()?.revision;
    return typeof revision === 'number' ? revision : null;
  } catch (error) {
    // Revision metadata is only a cache-invalidation hint. The task catalog can
    // still be loaded when this document is missing or its rules lag a deploy.
    console.warn('Problem library revision metadata is unavailable.', error);
    return null;
  }
};

const fetchProblemLibrary = async (): Promise<CachedProblemLibrary> => {
  const [revision, snapshots] = await Promise.all([
    fetchProblemLibraryRevision(),
    Promise.all(
      platforms.map(platform =>
        getDocs(collection(firestore, `problemsets/${platform}/problems`))
      )
    ),
  ]);

  const problems = snapshots.flatMap((snapshot, platformIndex) => {
    const platform = platforms[platformIndex];
    return snapshot.docs.map(problem => {
      const data = problem.data() as Partial<TagProblem>;
      const id = problem.id;
      return {
        key: `${platform}:${id}`,
        id,
        platform,
        title: data.title ?? id,
        url: data.url ?? `/solve/${platform}/${id}`,
        tags: data.tags ?? [],
      };
    });
  });
  return {
    revision,
    problems,
    index: Fuse.createIndex(problemLibrarySearchKeys, problems).toJSON(),
  };
};

const problemLibrarySyncVersionAtom = atom(0);
const problemLibraryRevisionAtom = atom<number | null>(null);
problemLibraryRevisionAtom.onMount = set =>
  onSnapshot(
    problemLibraryMetadata,
    snapshot => {
      const revision = snapshot.data()?.revision;
      set(typeof revision === 'number' ? revision : null);
    },
    error => {
      console.warn('Problem library revision listener is unavailable.', error);
      set(null);
    }
  );

const createProblemLibrarySearch = ({
  problems,
  index,
}: CachedProblemLibrary) =>
  new Fuse(
    problems,
    problemLibrarySearchOptions,
    Fuse.parseIndex<LibraryProblem>(index)
  );

let problemLibraryPromise: Promise<CachedProblemLibrary> | null = null;

const loadProblemLibrary = (): Promise<CachedProblemLibrary> => {
  if (problemLibraryPromise) {
    return problemLibraryPromise;
  }

  problemLibraryPromise = (async () => {
    const cached = await readCachedProblemLibrary();
    if (cached) return cached;

    const result = await fetchProblemLibrary();
    await cacheProblemLibrary(result);
    return result;
  })().catch(error => {
    problemLibraryPromise = null;
    console.error('Could not load the problem library.', error);
    throw error instanceof Error
      ? error
      : new Error('Could not load the problem library.');
  });
  return problemLibraryPromise;
};

// The first read uses the persisted library, if present. A sync explicitly
// refreshes it from Firestore so normal task search does not re-read all tasks.
export const problemLibraryAtom = atom<Promise<LibraryProblem[]>>(async get => {
  get(problemLibrarySyncVersionAtom);
  return (await loadProblemLibrary()).problems;
});

export const problemLibrarySearchAtom = atom<Promise<Fuse<LibraryProblem>>>(
  async get => {
    get(problemLibrarySyncVersionAtom);
    return createProblemLibrarySearch(await loadProblemLibrary());
  }
);

export const problemLibraryIsStaleAtom = atom(get => {
  const remoteRevision = get(problemLibraryRevisionAtom);
  get(problemLibrarySyncVersionAtom);
  if (remoteRevision === null) return false;

  return readCachedRevision() !== remoteRevision;
});

export const syncProblemLibraryAtom = atom(null, async (_get, set) => {
  try {
    const result = await fetchProblemLibrary();
    await cacheProblemLibrary(result);
    problemLibraryPromise = Promise.resolve(result);
    set(problemLibrarySyncVersionAtom, version => version + 1);
  } catch (error) {
    problemLibraryPromise = null;
    throw error;
  }
});
