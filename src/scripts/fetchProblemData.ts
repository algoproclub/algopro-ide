import { PlatformProblem, ProblemData } from '../types/problem';
import { Sample } from '../types/judge';
import { ElementType } from 'domelementtype';
import * as domhandler from 'domhandler';
import * as cheerio from 'cheerio';
import { getFirestore } from 'firebase-admin/firestore';

async function fetchWithProxy(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const loginBotUrl =
    process.env.NODE_ENV !== 'production'
      ? 'http://login-bot:3100'
      : 'https://login-bot.algopro.hu';
  return await fetch(
    loginBotUrl + '/proxy?' + new URLSearchParams({ url }).toString(),
    init
  );
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

const CODEFORCES_PROBLEM_REGEX = /^(\d+)([A-Z].*)$/;
const CODEFORCES_TITLE_REGEX = /\w+\. (.*)/;

const ATCODER_PROBLEM_REGEX = /(\w+)_(\w+)/;

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
  let html = element.html() ?? '';
  return html
    .replaceAll(/\${6}(.*?)\${6}/g, '<var class="display">$1</var>')
    .replaceAll(/\${3}(.*?)\${3}/g, '<var>$1</var>');
}

async function fetchProblemDataCodeforces(
  problemID: string
): Promise<ProblemData | null> {
  const matches = problemID.match(CODEFORCES_PROBLEM_REGEX);
  if (!matches) {
    return null;
  }

  const url = `https://codeforces.com/contest/${matches[1]}/problem/${matches[2]}`;
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
  const matches = problemID.match(ATCODER_PROBLEM_REGEX);
  if (!matches) {
    return null;
  }

  const url = `https://atcoder.jp/contests/${matches[1]}/tasks/${problemID}`;
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
  const url = `https://cses.fi/problemset/task/${problemID}`;
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
  const url = `https://www.spoj.com/problems/${problemID}/`;
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
  const url = `https://oj.uz/problem/view/${problemID}`;
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
