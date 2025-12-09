import { PlatformProblem, ProblemData } from '../types/problem';
import { Sample } from '../types/judge';
import { ElementType } from 'domelementtype';
import * as domhandler from 'domhandler';
import * as cheerio from 'cheerio';
import showdown from 'showdown';
import { getFirestore } from 'firebase-admin/firestore';
import {
  CODEFORCES_TITLE_REGEX,
  buildCodeforcesUrl,
  buildAtCoderUrl,
  buildCsesUrl,
  buildSpojUrl,
  buildOjuzUrl,
  buildNjudgeUrl,
  buildYosupoUrl,
} from './problemUtils';

async function fetchWithProxy(
  url: string,
  init?: RequestInit
): Promise<Response> {
  return await fetch(
    process.env.LOGIN_BOT_URL +
      '/proxy?' +
      new URLSearchParams({ url }).toString(),
    init
  );
}

async function fetchWithOptionalProxy(
  url: string,
  init?: RequestInit
): Promise<Response> {
  if (process.env.LOGIN_BOT_URL) {
    try {
      return await fetchWithProxy(url, init);
    } catch (error) {
      console.warn('Proxy fetch failed, falling back to direct fetch', error);
    }
  }
  return await fetch(url, init);
}

// FIXME: We might need to escape HTML entities (?)
function htmlToPlaintext(node: domhandler.ChildNode): string {
  if (node instanceof domhandler.Text) {
    return node.data;
  }
  if (node instanceof domhandler.Element) {
    const lineBreak =
      node.type === ElementType.Tag &&
      (node.tagName === 'br' ||
        (node.tagName === 'div' &&
          node.attribs.class.includes('test-example-line')));
    return (
      node.children.map(htmlToPlaintext).join('') + (lineBreak ? '\n' : '')
    );
  }
  return '';
}

function getTextNode(element: cheerio.Cheerio<domhandler.Element>): string {
  return element
    .contents()
    .filter((_, el) => el.type === 'text')
    .text()
    .trim();
}

export async function fetchProblemData({
  platform,
  id,
}: PlatformProblem): Promise<ProblemData | null> {
  switch (platform) {
    case 'codeforces':
      return fetchProblemDataCodeforces(id);
    case 'atcoder':
      return fetchProblemDataAtCoder(id);
    case 'cses':
      return fetchProblemDataCSES(id);
    case 'spoj':
      return fetchProblemDataSPOJ(id);
    case 'planets':
      return fetchProblemDataPlanets(id);
    case 'ojuz':
      return fetchProblemDataOjuz(id);
    case 'njudge':
      return fetchProblemDataNjudge(id);
    case 'yosupo':
      return fetchProblemDataYosupo(id);
    default:
      throw new Error(`platform '${platform}' is unimplemented`);
  }
}

const db = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ? getFirestore('planets')
  : getFirestore();

async function fetchProblemDataPlanets(
  problemID: string
): Promise<ProblemData | null> {
  const problem = await db.doc(`problems/${problemID}`).get();
  if (!problem.exists) {
    throw Error('Problem ID not found.');
  }
  const data = problem.data();
  return { ...data } as ProblemData;
}

function delimitedMathToVar(
  element: cheerio.Cheerio<domhandler.Element>
): string {
  const html = element.html() ?? '';
  return html
    .replaceAll(/\${6}(.*?)\${6}/g, '<var class="display">$1</var>')
    .replaceAll(/\${3}(.*?)\${3}/g, '<var>$1</var>');
}

async function fetchProblemDataCodeforces(
  problemID: string
): Promise<ProblemData | null> {
  const url = buildCodeforcesUrl(problemID);
  if (!url) return null;

  const problemPage = await fetchWithProxy(url, {
    headers: {
      'User-Agent':
        // same as login-bot
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });
  if (problemPage.status !== 200) {
    return null;
  }

  const document = cheerio.load(await problemPage.text());

  const samples: Sample[] = [];
  const inputsAndOutputs = Array.from(document('.sample-test pre')).map(
    htmlToPlaintext
  );
  for (let i = 0; i < inputsAndOutputs.length; i += 2) {
    samples.push({
      input: inputsAndOutputs[i],
      output: inputsAndOutputs[i + 1],
    });
  }

  // Bypass Cloudflare Hotlink Protection on images
  document('img').each((_, el) => {
    document(el).attr('referrerpolicy', 'no-referrer');
  });
  return {
    id: problemID,
    submittable: true,
    platform: 'codeforces',
    url,
    title: document('.header > .title')
      .text()
      .match(CODEFORCES_TITLE_REGEX)![1],
    statement: document('.problem-statement > :not(.header)')
      .map((_, el) => delimitedMathToVar(document(el)))
      .toArray()
      .join('\n'),
    input: 'stdin',
    output: 'stdout',
    source: `Codeforces ${problemID}`,
    timeLimit: getTextNode(document('.time-limit')),
    memoryLimit: getTextNode(document('.memory-limit')),
    templateCode: null,
    samples,
  };
}

async function fetchProblemDataAtCoder(
  problemID: string
): Promise<ProblemData | null> {
  const url = buildAtCoderUrl(problemID);
  if (!url) return null;
  const problemPage = await fetch(url);
  if (problemPage.status !== 200) {
    return null;
  }

  const document = cheerio.load(await problemPage.text());

  document().remove('span.btn');

  const samples: Sample[] = [];
  const inputsAndOutputs = document('#task-statement .lang-en > div')
    .filter((_, el) => document('h3', el).text().startsWith('Sample'))
    .map((_, el) => document('pre', el).text())
    .get();

  for (let i = 0; i < inputsAndOutputs.length; i += 2)
    samples.push({
      input: inputsAndOutputs[i],
      output: inputsAndOutputs[i + 1],
    });

  const title = getTextNode(document('span.h2'));

  const statement = document('#task-statement .lang-en > div')
    .map((_, el) => document(el).html())
    .toArray()
    .join('\n');

  const limits = document("p:contains('Time Limit')")
    .text()
    .match(/Time Limit: (.*) \/ Memory Limit: (.*)/);

  return {
    id: problemID,
    submittable: true,
    platform: 'atcoder',
    url,
    title,
    statement,
    input: 'stdin',
    output: 'stdout',
    source: `AtCoder ${problemID}`,
    samples,
    ...(limits && { timeLimit: limits[1], memoryLimit: limits[2] }),
    templateCode: null,
  };
}

async function fetchProblemDataCSES(
  problemID: string
): Promise<ProblemData | null> {
  const url = buildCsesUrl(problemID);
  const problemPage = await fetch(url);
  if (problemPage.status !== 200) {
    return null;
  }

  const document = cheerio.load(await problemPage.text());

  // CSES returns 200 OK for non-existent problem IDs
  if (document('.title-block').length === 0) {
    return null;
  }

  // Fix up relative URLs to point to the cses.fi domain
  document('img').each((_, el) => {
    const src = document(el).attr('src');
    if (!src) return;
    document(el).attr('src', new URL(src, url).href);
  });

  const sections: {
    heading: string | null;
    children: (domhandler.Element | domhandler.Text)[];
  }[] = [{ heading: null, children: [] }];
  for (const el of document('.md').first().contents()) {
    if (el.type !== ElementType.Tag && el.type !== ElementType.Text) continue;

    if (el.type === ElementType.Tag && el.tagName === 'h1') {
      sections.push({ heading: document(el).text(), children: [el] });
    } else {
      sections[sections.length - 1].children.push(el);
    }
  }

  const samples = sections
    .filter(s => s.heading?.startsWith('Example'))
    .map(s => {
      const [input, output] = s.children
        .filter(el => el.type === ElementType.Tag && el.tagName === 'pre')
        .map(htmlToPlaintext);
      return { input, output };
    });

  const nodeContents = (c: domhandler.Element | domhandler.Text) =>
    c.type === ElementType.Text ? c.data : document(c).prop('outerHTML');

  return {
    id: problemID,
    submittable: true,
    platform: 'cses',
    url,
    title: document('.title-block > h1').text(),
    statement: sections
      .map(s => s.children.map(nodeContents).join(''))
      .join('\n'),
    input: 'stdin',
    output: 'stdout',
    timeLimit: getTextNode(
      document('.task-constraints > li:contains("Time limit:")')
    ),
    memoryLimit: getTextNode(
      document('.task-constraints > li:contains("Memory limit:")')
    ),
    source: `CSES ${problemID}`,
    samples,
    templateCode: null,
  };
}

async function fetchProblemDataSPOJ(
  problemID: string
): Promise<ProblemData | null> {
  const url = buildSpojUrl(problemID);
  const problemPage = await fetch(url);
  if (problemPage.status !== 200) {
    return null;
  }

  const document = cheerio.load(await problemPage.text());

  // SPOJ responds with a 200 (and a JS-based redirect) to invalid
  // problem IDs. Detect this by the lack of a problem name element.
  const title = getTextNode(document('#problem-name'));
  if (title === '') {
    return null;
  }

  // Fix up relative URLs
  document('img').each((_, el) => {
    const src = document(el).attr('src');
    if (!src) return;
    document(el).attr('src', new URL(src, url).href);
  });

  // Try to match the following patterns:
  //
  // <>Sample Input</>
  // <pre>
  // ...
  // </pre>
  //
  // <>Sample</>
  // <>Input</>
  // <pre>
  // ...
  // </pre>
  const inputBlocks = document(
    ':is(:contains("Example Input"), :contains("Sample Input"), :is(:contains("Example"), :contains("Sample")) ~ :not(pre):contains("Input")) + pre'
  );
  const outputBlocks = document(
    ':is(:contains("Example Output"), :contains("Sample Output"), :is(:contains("Example"), :contains("Sample")) ~ :not(pre):contains("Output")) + pre'
  );

  // Try to match the following pattern:
  //
  // <>Example</>
  // <pre>
  // Input:
  // ...
  //
  // Output:
  // ...
  // </pre>
  const exampleBlocks = document(
    ':is(:contains("Example"), :contains("Sample")) ~ pre'
  );

  let samples: Sample[] = [];
  if (inputBlocks.length > 0 && outputBlocks.length > 0) {
    if (inputBlocks.length === outputBlocks.length) {
      samples = inputBlocks.toArray().map((inputBlock, i) => ({
        input: htmlToPlaintext(inputBlock),
        output: htmlToPlaintext(outputBlocks[i]),
      }));
    } else {
      console.warn(
        `Mismatched length of parsed sample inputs (${inputBlocks.length}) and outputs (${outputBlocks.length})`
      );
    }
  } else if (exampleBlocks.length > 0) {
    samples = exampleBlocks.toArray().flatMap(el => {
      const content = htmlToPlaintext(el);
      const matches = content.match(
        /(Example |Sample )?Input:?\n(.*)\n(Example |Sample )?Output:?\n(.*)/ims
      );
      if (!matches) {
        console.warn(
          `Failed to parse sample for SPOJ ${problemID} from:\n${content}`
        );
      }

      return matches
        ? [{ input: matches[2].trim(), output: matches[4].trim() }]
        : [];
    });
  } else {
    console.warn(`Failed to find any samples for SPOJ ${problemID}`);
  }

  const statement = document('#problem-body')
    .map((_, el) => document(el).html())
    .toArray()
    .join('\n');

  return {
    id: problemID,
    submittable: true,
    platform: 'spoj',
    url,
    title,
    statement,
    input: 'stdin',
    output: 'stdout',
    source: `SPOJ ${problemID}`,
    memoryLimit: getTextNode(
      document('#problem-meta td:contains("Memory limit:") + td')
    ),
    timeLimit: getTextNode(
      document('#problem-meta td:contains("Time limit:") + td')
    ),
    samples,
    templateCode: null,
  };
}

async function fetchProblemDataOjuz(
  problemID: string
): Promise<ProblemData | null> {
  const url = buildOjuzUrl(problemID);
  const problemPage = await fetch(url);
  if (problemPage.status !== 200) {
    return null;
  }

  const document = cheerio.load(await problemPage.text());

  const title = getTextNode(document('.problem-title h1'));

  const statementURL = document('#problem-statement-pdf > a').attr('href');

  if (statementURL === undefined) {
    console.error(`No PDF statement found for Oj.uz ${problemID}`);
    return null;
  }

  return {
    id: problemID,
    submittable: true,
    platform: 'ojuz',
    url,
    title,
    statement: null,
    statementURL,
    templateCode: null,
    samples: [],
    input: 'stdin',
    output: 'stdout',
    source: `Oj.uz ${problemID}`,
  };
}

async function fetchProblemDataNjudge(
  problemID: string
): Promise<ProblemData | null> {
  const url = buildNjudgeUrl(problemID);
  const problemPage = await fetch(url, {
    headers: { 'Accept-Language': 'hu' },
  });
  if (problemPage.status !== 200) {
    return null;
  }

  const document = cheerio.load(await problemPage.text());

  const titleHeading = document('div:Contains("Cím:")');
  const title = titleHeading.next().text().trim();

  let statementURL = null;
  for (const language of ['hungarian', 'english']) {
    const pdfURL = `https://njudge.hu/problemset/main/${problemID}/pdf/${language}/`;

    // method: 'HEAD' returns 404
    const exists = (await fetch(pdfURL)).ok;
    if (exists) {
      statementURL = pdfURL;
      break;
    }
  }

  if (!statementURL) {
    console.error(`No PDF statement found for njudge ${problemID}`);
    return null;
  }

  return {
    id: problemID,
    submittable: true,
    platform: 'njudge',
    url,
    title,
    statement: null,
    statementURL,
    templateCode: null,
    samples: [],
    input: 'stdin',
    output: 'stdout',
    source: `njudge ${problemID}`,
  };
}

const YOSUPO_REST_BASE = 'https://v3.api.judge.yosupo.jp';
const YOSUPO_STORAGE_BASE = new URL(
  'https://storage.googleapis.com/v2-prod-library-checker-data-public/'
);
const YOSUPO_VERSION_PREFIX = 'v4';

const GITHUB_API_BASE =
  'https://api.github.com/repos/yosupo06/library-checker-problems/contents';
const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/yosupo06/library-checker-problems/master';
const GITHUB_HEADERS = {
  'User-Agent': 'AlgoPro IDE/1.0',
  Accept: 'application/vnd.github.v3+json',
} as const;

type YosupoProblemInfo = {
  title: string;
  time_limit: number;
  version: string;
  overall_version: string;
  testcases_version: string;
  source_url: string;
};

type YosupoInfoToml = {
  tests: { name: string; number: number }[];
  params: Record<string, bigint>;
};

const YOSUPO_KEYWORD_MAP: Record<string, string> = {
  statement: 'Problem Statement',
  constraints: 'Constraints',
  input: 'Input',
  output: 'Output',
  sample: 'Sample',
  samples: 'Samples',
  note: 'Note',
  notes: 'Notes',
  subtasks: 'Subtasks',
  prerequisites: 'Prerequisites',
};

function defaultYosupoKeyword(key: string): string {
  return key
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatYosupoParam(value: bigint): string {
  if (value === 0n) {
    return '0';
  }
  if (value % 100_000n === 0n) {
    let k = 5n;
    while (value % 10n ** (k + 1n) === 0n) {
      k += 1n;
    }
    if (value === 10n ** k) {
      return `10^{${k}}`;
    }
    return `${value / 10n ** k} \\times 10^{${k}}`;
  }
  if (value % (1n << 10n) === 0n) {
    let k = 10n;
    while (value % (1n << (k + 1n)) === 0n) {
      k += 1n;
    }
    if (value === 1n << k) {
      return `2^{${k}}`;
    }
  }
  return value.toString();
}

function maybeExtractStringValue(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^["'](.*)["']$/);
  if (match) {
    return match[1];
  }
  return trimmed.length > 0 ? trimmed : null;
}

function parseTomlBigInt(value: string): bigint | null {
  const sanitized = value.replace(/_/g, '').trim();
  if (/^-?\d+$/.test(sanitized)) {
    try {
      return BigInt(sanitized);
    } catch {
      return null;
    }
  }
  if (/^-?\d+\.\d+$/.test(sanitized)) {
    return BigInt(Math.floor(Number(sanitized)));
  }
  return null;
}

function parseYosupoInfoToml(raw: string): YosupoInfoToml {
  const info: YosupoInfoToml = { tests: [], params: {} };
  let currentTest: { name?: string; number?: number } | null = null;
  let section: 'tests' | 'params' | null = null;

  const commitTest = () => {
    if (currentTest?.name && typeof currentTest.number === 'number') {
      info.tests.push({
        name: currentTest.name,
        number: currentTest.number,
      });
    }
    currentTest = null;
  };

  const lines = raw.split(/\r?\n/);
  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();
    if (trimmedLine === '' || trimmedLine.startsWith('#')) {
      continue;
    }

    if (trimmedLine === '[[tests]]') {
      commitTest();
      section = 'tests';
      currentTest = {};
      continue;
    }

    if (trimmedLine === '[params]') {
      commitTest();
      section = 'params';
      currentTest = null;
      continue;
    }

    if (trimmedLine.startsWith('[[') || trimmedLine.startsWith('[')) {
      commitTest();
      section = null;
      currentTest = null;
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!match) {
      continue;
    }

    const [, key, valueRawOriginal] = match;
    let valueRaw = valueRawOriginal.trim();
    const commentIndex = valueRaw.indexOf('#');
    if (commentIndex >= 0) {
      valueRaw = valueRaw.slice(0, commentIndex).trim();
    }

    if (section === 'tests' && currentTest) {
        if (key === 'name') {
          const name = maybeExtractStringValue(valueRaw);
        if (name !== null) {
          currentTest.name = name;
        }
      } else if (key === 'number') {
        const parsed = Number(valueRaw.replace(/_/g, ''));
        if (!Number.isNaN(parsed)) {
          currentTest.number = parsed;
        }
      }
      continue;
    }

    if (section === 'params') {
      const paramValue = parseTomlBigInt(valueRaw);
      if (paramValue !== null) {
        info.params[key] = paramValue;
      }
      continue;
    }
  }

  commitTest();
  return info;
}

type GithubContentEntry = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
};

async function fetchGithubJson<T>(
  url: string,
  init?: RequestInit
): Promise<T | null> {
  const response = await fetchWithOptionalProxy(url, {
    ...init,
    headers: {
      ...GITHUB_HEADERS,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

async function fetchGithubContents(
  path: string
): Promise<GithubContentEntry[] | null> {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  const url =
    trimmed.length === 0
      ? `${GITHUB_API_BASE}?ref=master`
      : `${GITHUB_API_BASE}/${trimmed}?ref=master`;
  return await fetchGithubJson<GithubContentEntry[]>(url);
}

async function fetchGithubFileText(path: string): Promise<string | null> {
  const trimmed = path.replace(/^\/+/, '');
  const response = await fetchWithOptionalProxy(
    `${GITHUB_RAW_BASE}/${trimmed}`
  );
  if (!response.ok) {
    return null;
  }
  return await response.text();
}

async function downloadRawFile(
  url: string | null
): Promise<string | null> {
  if (!url) {
    return null;
  }
  const response = await fetchWithOptionalProxy(url);
  if (!response.ok) {
    return null;
  }
  return await response.text();
}

function prettifyYosupoSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

async function locateGithubProblemPath(slug: string): Promise<string | null> {
  const preferredPrefixes = [
    'sample',
    'datastructure',
    'graph',
    'math',
    'geometry',
    'string',
    'tree',
    'misc',
    'dp',
    'flow',
    'enumerative',
    'numbertheory',
  ];

  const visited = new Set<string>();

  const tryDirectory = async (dir: string): Promise<string | null> => {
    const contents = await fetchGithubContents(dir);
    if (!contents) {
      return null;
    }
    visited.add(dir);
    const match = contents.find(
      entry => entry.type === 'dir' && entry.name === slug
    );
    return match ? match.path : null;
  };

  for (const prefix of preferredPrefixes) {
    const result = await tryDirectory(prefix);
    if (result) {
      return result;
    }
  }

  const root = await fetchGithubContents('');
  if (!root) {
    return null;
  }

  for (const entry of root) {
    if (entry.type !== 'dir') {
      continue;
    }
    if (visited.has(entry.path)) {
      continue;
    }
    const result = await tryDirectory(entry.path);
    if (result) {
      return result;
    }
  }

  return null;
}

function stripExtension(filename: string): string {
  const index = filename.lastIndexOf('.');
  return index >= 0 ? filename.slice(0, index) : filename;
}

async function fetchGithubExamples(
  basePath: string
): Promise<{ examples: Record<string, string>; samples: Sample[] }> {
  const examples: Record<string, string> = {};
  const samples: Sample[] = [];

  const inputEntries = await fetchGithubContents(`${basePath}/in`);
  const outputEntries = await fetchGithubContents(`${basePath}/out`);

  if (inputEntries === null) {
    return { examples, samples };
  }
  if (outputEntries === null) {
    return { examples, samples };
  }

  const outputMap = new Map<string, GithubContentEntry>();
  for (const entry of outputEntries) {
    if (entry.type === 'file') {
      outputMap.set(stripExtension(entry.name), entry);
    }
  }

  for (const entry of inputEntries) {
    if (entry.type !== 'file') {
      continue;
    }
    const baseName = stripExtension(entry.name);
    const inputText = await downloadRawFile(entry.download_url);
    if (inputText === null) {
      continue;
    }
    const outputEntry = outputMap.get(baseName);
    const outputText =
      outputEntry === undefined
        ? ''
        : await downloadRawFile(outputEntry.download_url);

    examples[`${baseName}.in`] = trimTrailingNewlines(inputText);
    if (outputText !== null && outputText !== undefined) {
      examples[`${baseName}.out`] = trimTrailingNewlines(outputText);
      samples.push({
        input: trimTrailingNewlines(inputText),
        output: trimTrailingNewlines(outputText ?? ''),
      });
    } else {
      samples.push({
        input: trimTrailingNewlines(inputText),
        output: '',
      });
    }
  }

  return { examples, samples };
}

async function fetchYosupoProblemFromGithub(
  problemID: string
): Promise<ProblemData | null> {
  try {
    const problemPath = await locateGithubProblemPath(problemID);
    if (!problemPath) {
      return null;
    }

    const [taskMd, infoToml] = await Promise.all([
      fetchGithubFileText(`${problemPath}/task.md`),
      fetchGithubFileText(`${problemPath}/info.toml`),
    ]);

    if (!taskMd) {
      return null;
    }

    const info = infoToml
      ? parseYosupoInfoToml(infoToml)
      : { tests: [], params: {} };

    const { examples, samples } = await fetchGithubExamples(problemPath);
    const statementHtml = renderYosupoStatement(taskMd, info, examples);

    return {
      id: problemID,
      submittable: true,
      platform: 'yosupo',
      url: buildYosupoUrl(problemID),
      title: info.title ?? prettifyYosupoSlug(problemID),
      statement: statementHtml,
      input: 'stdin',
      output: 'stdout',
      source: `Yosupo Library Checker ${problemID}`,
      samples,
      timeLimit:
        typeof info.timeLimit === 'number'
          ? `${info.timeLimit}s`
          : undefined,
      templateCode: null,
    };
  } catch (error) {
    console.error(`GitHub fallback failed for Yosupo ${problemID}`, error);
    return null;
  }
}

function buildYosupoFileUrl(
  problemID: string,
  metadata: YosupoProblemInfo,
  filename: string
): string {
  return new URL(
    `${YOSUPO_VERSION_PREFIX}/files/${problemID}/${metadata.overall_version}/${problemID}/${filename}`,
    YOSUPO_STORAGE_BASE
  ).toString();
}

function buildYosupoExampleUrl(
  problemID: string,
  metadata: YosupoProblemInfo,
  kind: 'in' | 'out',
  exampleName: string
): string {
  return new URL(
    `${YOSUPO_VERSION_PREFIX}/examples/${problemID}/${metadata.testcases_version}/${kind}/${exampleName}.${kind}`,
    YOSUPO_STORAGE_BASE
  ).toString();
}

function trimTrailingNewlines(value: string): string {
  return value.replace(/[\r\n]+$/, '');
}

async function tryFetchingTextMaybe(url: string): Promise<string | null> {
  const response = await fetchWithOptionalProxy(url);
  if (!response.ok) {
    console.warn(`Failed to fetch ${url}: ${response.status}`);
    return null;
  }
  return await response.text();
}

function renderYosupoMarkdown(
  source: string,
  params: Record<string, bigint>,
  examples: Record<string, string>,
  targetLang: 'en' | 'ja' = 'en'
): string {
  const output: string[] = [];
  const lines = source.split(/\r?\n/);
  let currentLang: string | null = null;
  let exampleCounter = 0;

  const keywordRegex = /@{keyword\.([a-zA-Z0-9_]+)}/g;
  const paramRegex = /@{param\.([A-Z0-9_]+)}/g;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const langMatch = trimmed.match(/^@{lang\.([a-zA-Z0-9_]+)}$/);
    if (langMatch) {
      const langValue = langMatch[1].toLowerCase();
      if (langValue === 'end') {
        currentLang = null;
      } else {
        currentLang = langValue;
      }
      continue;
    }

    if (currentLang && currentLang !== targetLang) {
      continue;
    }

    const exampleMatch = trimmed.match(/^@{example\.([a-zA-Z0-9_]+)}$/);
    if (exampleMatch) {
      exampleCounter += 1;
      const baseName = exampleMatch[1];
      const input =
        examples[`${baseName}.in`] ?? `${baseName}.in not found!`;
      const outputSample =
        examples[`${baseName}.out`] ?? `${baseName}.out not found!`;
      output.push(`### #${exampleCounter}`);
      output.push('');
      output.push('```');
      output.push(input);
      output.push('```');
      output.push('');
      output.push('```');
      output.push(outputSample);
      output.push('```');
      continue;
    }

    let line = rawLine;
    line = line.replace(keywordRegex, (_, key: string) => {
      const normalized = key.toLowerCase();
      return (
        YOSUPO_KEYWORD_MAP[normalized] ?? defaultYosupoKeyword(normalized)
      );
    });
    line = line.replace(paramRegex, (_, key: string) => {
      const paramValue = params[key];
      return paramValue !== undefined
        ? formatYosupoParam(paramValue)
        : key;
    });
    output.push(line);
  }

  return output.join('\n');
}

const YOSUPO_MATH_PLACEHOLDER_PREFIX = '__YOSUPO_MATH_';

function protectYosupoMath(markdown: string) {
  const segments: string[] = [];
  const protectedText = markdown.replace(
    /\$\$(?:[\s\S]*?)\$\$|\$(?:[\s\S]*?)\$/g,
    match => {
      const placeholder = `${YOSUPO_MATH_PLACEHOLDER_PREFIX}${segments.length}__`;
      segments.push(match);
      return placeholder;
    }
  );
  return { protectedText, segments };
}

function restoreYosupoMath(html: string, segments: string[]) {
  return segments.reduce(
    (text, segment, index) =>
      text.replace(
        `${YOSUPO_MATH_PLACEHOLDER_PREFIX}${index}__`,
        segment
      ),
    html
  );
}

function renderYosupoStatement(
  taskMd: string,
  info: YosupoInfoToml,
  examples: Record<string, string>
): string {
  const markdown = renderYosupoMarkdown(taskMd, info.params, examples);
  const { protectedText, segments } = protectYosupoMath(markdown);
  const converter = new showdown.Converter({
    simpleLineBreaks: true,
    strikethrough: true,
    tables: true,
    ghCodeBlocks: true,
    literalMidWordUnderscores: true,
  });
  const html = converter.makeHtml(protectedText);
  return restoreYosupoMath(html, segments);
}

async function fetchYosupoExamples(
  problemID: string,
  metadata: YosupoProblemInfo,
  info: YosupoInfoToml
): Promise<{ examples: Record<string, string>; samples: Sample[] }> {
  const examples: Record<string, string> = {};
  const samples: Sample[] = [];

  const exampleTest = info.tests.find(test => test.name === 'example.in');
  const exampleCount = exampleTest?.number ?? 0;
  const exampleNames = Array.from({ length: exampleCount }, (_, idx) =>
    `example_${idx.toString().padStart(2, '0')}`
  );

  for (const name of exampleNames) {
    const [inputRaw, outputRaw] = await Promise.all([
      tryFetchingTextMaybe(buildYosupoExampleUrl(problemID, metadata, 'in', name)),
      tryFetchingTextMaybe(buildYosupoExampleUrl(problemID, metadata, 'out', name)),
    ]);

    if (inputRaw !== null) {
      examples[`${name}.in`] = trimTrailingNewlines(inputRaw);
    }
    if (outputRaw !== null) {
      examples[`${name}.out`] = trimTrailingNewlines(outputRaw);
    }

    if (inputRaw !== null || outputRaw !== null) {
      samples.push({
        input: inputRaw !== null ? trimTrailingNewlines(inputRaw) : '',
        output: outputRaw !== null ? trimTrailingNewlines(outputRaw) : '',
      });
    }
  }

  return { examples, samples };
}

async function fetchYosupoProblemPrimary(
  problemID: string
): Promise<ProblemData | null> {
  try {
    const metadataResponse = await fetchWithOptionalProxy(
      `${YOSUPO_REST_BASE}/problems/${problemID}`
    );
    if (!metadataResponse.ok) {
      return null;
    }
    const metadata = (await metadataResponse.json()) as YosupoProblemInfo;

    const [taskMd, infoToml] = await Promise.all([
      tryFetchingTextMaybe(buildYosupoFileUrl(problemID, metadata, 'task.md')),
      tryFetchingTextMaybe(buildYosupoFileUrl(problemID, metadata, 'info.toml')),
    ]);

    if (!taskMd) {
      return null;
    }

    const info = infoToml
      ? parseYosupoInfoToml(infoToml)
      : { tests: [], params: {} };

    const { examples, samples } = await fetchYosupoExamples(
      problemID,
      metadata,
      info
    );

    const statementHtml = renderYosupoStatement(taskMd, info, examples);

    return {
      id: problemID,
      submittable: true,
      platform: 'yosupo',
      url: buildYosupoUrl(problemID),
      title: metadata.title ?? `Yosupo ${problemID}`,
      statement: statementHtml,
      input: 'stdin',
      output: 'stdout',
      source: `Yosupo Library Checker ${problemID}`,
      samples,
      timeLimit:
        typeof metadata.time_limit === 'number'
          ? `${metadata.time_limit}s`
          : undefined,
      templateCode: null,
    };
  } catch (error) {
    console.error(`Failed to fetch Yosupo problem ${problemID}`, error);
    return null;
  }
}

async function fetchProblemDataYosupo(
  problemID: string
): Promise<ProblemData | null> {
  const primary = await fetchYosupoProblemPrimary(problemID);
  if (primary) {
    return primary;
  }

  const fallback = await fetchYosupoProblemFromGithub(problemID);
  if (fallback) {
    return fallback;
  }

  return null;
}
