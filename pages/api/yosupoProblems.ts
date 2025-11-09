import type { NextApiRequest, NextApiResponse } from 'next';
import type { TagProblem } from '../../src/types/problem';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseApp from '../../src/firebaseAdmin';

const PRIMARY_SOURCE = 'https://judge.yosupo.jp/api/problems';
const FALLBACK_SOURCE =
  'https://raw.githubusercontent.com/yosupo06/library-checker-problems/master/problem-list.json';
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

type CacheEntry = {
  data: TagProblem[];
  timestamp: number;
};

let cache: CacheEntry | null = null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TagProblem[] | { error: string }>
) {
  try {
    const forceRefresh = req.query.force === '1';
    const problems = await getYosupoProblems(forceRefresh);
    res.status(200).json(problems);
  } catch (error) {
    console.error('Failed to fetch Yosupo problem list', error);
    res.status(502).json({ error: 'Failed to fetch Yosupo problem list' });
  }
}

export async function getYosupoProblems(forceRefresh: boolean) {
  if (!forceRefresh && cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const problems = await fetchFromAvailableSources();
  cache = { data: problems, timestamp: Date.now() };
  return problems;
}

async function fetchFromAvailableSources(): Promise<TagProblem[]> {
  const sources = [PRIMARY_SOURCE, FALLBACK_SOURCE];
  const errors: unknown[] = [];

  for (const url of sources) {
    try {
      const problems = await fetchAndNormalize(url);
      if (problems.length > 0) {
        return problems;
      }
    } catch (error) {
      errors.push({ url, error });
    }
  }

  // Try GitHub API as another fallback
  try {
    const githubProblems = await fetchFromGitHub();
    if (githubProblems.length > 0) {
      return githubProblems;
    }
  } catch (error) {
    errors.push({ source: 'github', error });
  }

  // Network failed; fall back to Firestore-seeded items if any
  const fallback = await fetchFromFirestore();
  if (fallback.length > 0) {
    return fallback;
  }

  throw new Error(
    `All Yosupo sources failed: ${errors
      .map(entry => JSON.stringify(entry))
      .join('; ')}`
  );
}

async function fetchAndNormalize(url: string): Promise<TagProblem[]> {
  const payload = await fetchJSONWithProxy(url);
  const rawProblems = extractProblemArray(payload);
  const normalized = rawProblems
    .map(normalizeYosupoProblem)
    .filter((problem): problem is TagProblem => problem !== null);

  const deduplicated = dedupeById(normalized);
  deduplicated.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  return deduplicated;
}

async function fetchFromGitHub(): Promise<TagProblem[]> {
  try {
    const response = await fetch('https://api.github.com/repos/yosupo06/library-checker-problems/contents', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AlgoPro IDE/1.0)',
        Accept: 'application/json',
      },
    });
    if (!response.ok) throw new Error(`GitHub API failed: ${response.status}`);
    const contents = await response.json();
    const categoryDirs = contents.filter((item: any) =>
      item.type === 'dir' &&
      !item.name.startsWith('.') &&
      item.name !== 'docs' &&
      item.name !== 'sample' &&
      item.name !== 'test' &&
      item.name !== 'generate.py'
    );
    const problems: TagProblem[] = [];
    for (const category of categoryDirs) {
      const categoryName = category.name;
      const catResponse = await fetch(`https://api.github.com/repos/yosupo06/library-checker-problems/contents/${categoryName}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AlgoPro IDE/1.0)',
          Accept: 'application/json',
        },
      });
      if (!catResponse.ok) continue;
      const catContents = await catResponse.json();
      const problemDirs = catContents.filter((item: any) => item.type === 'dir');
      for (const dir of problemDirs) {
        const problemId = dir.name;
        const infoResponse = await fetch(`https://raw.githubusercontent.com/yosupo06/library-checker-problems/master/${categoryName}/${problemId}/info.toml`);
        if (infoResponse.ok) {
          const tomlText = await infoResponse.text();
          const title = tomlText.match(/title\s*=\s*"([^"]+)"/)?.[1] || prettifyId(problemId);
          const tags = tomlText.match(/category\s*=\s*\[([^\]]+)\]/)?.[1]?.split(',').map((s: string) => s.trim().replace(/"/g, '')) || null;
          problems.push({
            id: problemId,
            platform: 'yosupo',
            title,
            url: `https://judge.yosupo.jp/problem/${problemId}`,
            tags,
          });
        }
      }
    }
    return problems;
  } catch (e) {
    console.warn('GitHub fallback failed', e);
    return [];
  }
}

async function fetchJSONWithProxy(url: string): Promise<unknown> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; AlgoPro IDE/1.0)',
    Accept: 'application/json',
  } as Record<string, string>;

  const proxyBase = process.env.LOGIN_BOT_URL;

  // Try proxy first if configured (common in restricted envs)
  if (proxyBase) {
    try {
      const proxied = await fetch(
        `${proxyBase}/proxy?` + new URLSearchParams({ url }).toString(),
        { headers }
      );
      if (proxied.ok) {
        return await proxied.json();
      }
    } catch (_) {
      // fall through to direct attempt
    }
  }

  // Try direct fetch as a fallback
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    // If not JSON, return the text as is (might be HTML)
    return text;
  }
}

async function fetchFromFirestore(): Promise<TagProblem[]> {
  try {
    const db = getFirestore(firebaseApp);
    const snap = await db
      .collection('problemsets')
      .doc('yosupo')
      .collection('problems')
      .get();

    return snap.docs
      .map((d: any) => d.data() as Partial<TagProblem>)
      .map((d: any) => ({
        id: d.id as string,
        platform: 'yosupo',
        title: (d.title as string) ?? (d.id as string),
        url:
          (d.url as string) ??
          (d.id ? `https://judge.yosupo.jp/problem/${d.id}` : ''),
        tags: (d.tags as string[]) ?? null,
      }))
      .filter((p: any) => !!p.id && !!p.url) as TagProblem[];
  } catch (e) {
    console.warn('Firestore fallback for Yosupo failed', e);
    return [];
  }
}

function extractProblemArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const candidates = [
      'problems',
      'result',
      'items',
      'data',
      'list',
      'problemset',
    ];
    for (const key of candidates) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
}

function normalizeYosupoProblem(raw: unknown): TagProblem | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const id =
    getString(obj.id) ??
    getString(obj.name) ??
    getString(obj.problem_id) ??
    getString(obj.slug);

  if (!id) {
    return null;
  }

  const title =
    getString(obj.title) ??
    getString(obj.full_name) ??
    getString(obj.problem_name) ??
    prettifyId(id);

  const tags =
    extractStringArray(obj.tags) ??
    extractStringArray(obj.categories) ??
    extractStringArray(obj.keywords) ??
    extractStringArray(obj.topics) ??
    extractStringArray(obj.labels) ??
    (getString(obj.group) ? [getString(obj.group)!] : null);

  const url = getString(obj.url)
    ? getString(obj.url)!
    : `https://judge.yosupo.jp/problem/${id}`;

  return {
    id,
    platform: 'yosupo',
    title,
    url,
    tags,
  };
}

function dedupeById(problems: TagProblem[]): TagProblem[] {
  const map = new Map<string, TagProblem>();
  for (const problem of problems) {
    if (problem.id && !map.has(problem.id)) {
      map.set(problem.id, problem);
    }
  }
  return Array.from(map.values());
}

function getString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return undefined;
}

function extractStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const normalized = value
    .map(entry => (typeof entry === 'string' ? entry.trim() : null))
    .filter((entry): entry is string => !!entry);
  return normalized.length > 0 ? normalized : null;
}

function prettifyId(id: string) {
  return id
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
