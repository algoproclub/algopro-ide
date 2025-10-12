import { PlatformProblem, ProblemData } from '../types/problem';
import { Sample } from '../types/judge';
import { ElementType } from 'domelementtype';
import * as domhandler from 'domhandler';
import * as cheerio from 'cheerio';
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

async function fetchProblemDataYosupo(
  problemID: string
): Promise<ProblemData | null> {
  const url = buildYosupoUrl(problemID);
  const problemPage = await fetch(url);
  if (problemPage.status !== 200) {
    console.error(`Yosupo fetch failed for ${problemID}: status ${problemPage.status}`);
    return null;
  }

  const html = await problemPage.text();
  const document = cheerio.load(html);

  // Try multiple selectors for title - Yosupo might use different structures
  let title = '';
  const titleSelectors = ['h1', '.title', '.problem-title', 'title', '[class*="title"]'];
  for (const selector of titleSelectors) {
    title = document(selector).first().text().trim();
    if (title) break;
  }
  if (!title) {
    title = `Yosupo Problem ${problemID}`; // fallback
  }

  // Extract problem statement - Yosupo might have the content in different containers
  let statement = '';
  const statementSelectors = [
    '.problem-statement',
    '.statement',
    '.content',
    '.problem-content',
    'main',
    'article',
    '.markdown',
    '[class*="problem"]'
  ];

  for (const selector of statementSelectors) {
    const element = document(selector).first();
    if (element.length > 0 && element.text().trim().length > 50) { // Ensure it's substantial content
      statement = element.html() || element.text();
      break;
    }
  }

  // If no statement found, try to get all text content from body
  if (!statement) {
    const bodyText = document('body').text();
    // Remove common header/footer text and extract main content
    const lines = bodyText.split('\n').filter(line => line.trim().length > 10);
    statement = lines.slice(0, 10).join('\n'); // Take first 10 substantial lines
  }

  // Extract samples - Yosupo typically has sample input/output in pre tags
  const samples: Sample[] = [];
  const preElements = document('pre');

  if (preElements.length >= 2) {
    // Group consecutive pre elements as input/output pairs
    for (let i = 0; i < preElements.length; i += 2) {
      if (i + 1 < preElements.length) {
        const input = htmlToPlaintext(preElements[i]);
        const output = htmlToPlaintext(preElements[i + 1]);
        if (input.trim() && output.trim()) {
          samples.push({ input: input.trim(), output: output.trim() });
        }
      }
    }
  }

  // Alternative: look for sections with "Sample" in headers
  if (samples.length === 0) {
    const sampleSections = document('*').filter((_, el) => {
      const text = document(el).text().toLowerCase();
      return text.includes('sample input') || text.includes('sample output');
    });

    if (sampleSections.length > 0) {
      sampleSections.each((_, el) => {
        const section = document(el);
        const pres = section.find('pre');
        if (pres.length >= 2) {
          const input = htmlToPlaintext(pres[0]);
          const output = htmlToPlaintext(pres[1]);
          if (input.trim() && output.trim()) {
            samples.push({ input: input.trim(), output: output.trim() });
          }
        }
      });
    }
  }

  // Extract time and memory limits - Yosupo might not have explicit limits
  const bodyText = document('body').text();
  const timeMatch = bodyText.match(/time(?:\s*limit)?:?\s*(\d+(?:\.\d+)?)\s*sec/i);
  const memoryMatch = bodyText.match(/memory(?:\s*limit)?:?\s*(\d+(?:\.\d+)?)\s*(?:mb|gb)/i);

  const timeLimit = timeMatch ? timeMatch[1] + 's' : undefined;
  const memoryLimit = memoryMatch ? memoryMatch[1] + memoryMatch[2] : undefined;

  return {
    id: problemID,
    submittable: true,
    platform: 'yosupo',
    url,
    title,
    statement: statement || null,
    input: 'stdin',
    output: 'stdout',
    source: `Yosupo Library Checker ${problemID}`,
    timeLimit,
    memoryLimit,
    samples,
    templateCode: null,
  };
}
