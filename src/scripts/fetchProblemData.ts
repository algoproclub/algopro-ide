import { PlatformProblem, ProblemData } from '../types/problem';
import { Sample } from '../types/judge';
import { ElementType } from 'domelementtype';
import * as domhandler from 'domhandler';
import * as cheerio from 'cheerio';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseApp from '../firebaseAdmin';
import {
  CODEFORCES_TITLE_REGEX,
  buildCodeforcesUrl,
  buildAtCoderUrl,
  buildCsesUrl,
  buildSpojUrl,
  buildOjuzUrl,
  buildNjudgeUrl,
} from './problemUtils';
import AdmZip from 'adm-zip';

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
    default:
      throw new Error(`platform '${platform}' is unimplemented`);
  }
}

// Parses problem data from an already-retrieved page (e.g. manually pasted
// by a teacher/admin when the live scrape fails), reusing the same
// per-platform parsing logic as the network-fetching functions below.
// Platforms without a scrapable page (planets, usaco) are unsupported here.
export async function parseProblemDataFromHtml({
  platform,
  id,
  html,
}: PlatformProblem & { html: string }): Promise<ProblemData | null> {
  switch (platform) {
    case 'codeforces': {
      const url = buildCodeforcesUrl(id);
      return url ? parseCodeforcesProblemData(html, id, url) : null;
    }
    case 'atcoder': {
      const url = buildAtCoderUrl(id);
      return url ? parseAtCoderProblemData(html, id, url) : null;
    }
    case 'cses':
      return parseCsesProblemData(html, id, buildCsesUrl(id));
    case 'spoj':
      return parseSpojProblemData(html, id, buildSpojUrl(id));
    case 'ojuz':
      return parseOjuzProblemData(html, id, buildOjuzUrl(id));
    case 'njudge':
      return parseNjudgeProblemData(html, id, buildNjudgeUrl(id));
    default:
      return null;
  }
}

const db = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ? getFirestore(firebaseApp, 'planets')
  : getFirestore(firebaseApp);

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

function parseCodeforcesProblemData(
  html: string,
  problemID: string,
  url: string
): ProblemData | null {
  const document = cheerio.load(html);

  const titleMatch = document('.header > .title')
    .text()
    .match(CODEFORCES_TITLE_REGEX);
  if (!titleMatch) return null;

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
    title: titleMatch[1],
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

  return parseCodeforcesProblemData(await problemPage.text(), problemID, url);
}

function parseAtCoderProblemData(
  html: string,
  problemID: string,
  url: string
): ProblemData | null {
  const document = cheerio.load(html);

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
  if (!title) return null;

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

async function fetchProblemDataAtCoder(
  problemID: string
): Promise<ProblemData | null> {
  const url = buildAtCoderUrl(problemID);
  if (!url) return null;
  const problemPage = await fetch(url);
  if (problemPage.status !== 200) {
    return null;
  }

  return parseAtCoderProblemData(await problemPage.text(), problemID, url);
}

function parseCsesProblemData(
  html: string,
  problemID: string,
  url: string
): ProblemData | null {
  const document = cheerio.load(html);

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

async function fetchProblemDataCSES(
  problemID: string
): Promise<ProblemData | null> {
  const url = buildCsesUrl(problemID);
  const problemPage = await fetch(url);
  if (problemPage.status !== 200) {
    return null;
  }

  return parseCsesProblemData(await problemPage.text(), problemID, url);
}

function parseSpojProblemData(
  html: string,
  problemID: string,
  url: string
): ProblemData | null {
  const document = cheerio.load(html);

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

async function fetchProblemDataSPOJ(
  problemID: string
): Promise<ProblemData | null> {
  const url = buildSpojUrl(problemID);
  const problemPage = await fetch(url);
  if (problemPage.status !== 200) {
    return null;
  }

  return parseSpojProblemData(await problemPage.text(), problemID, url);
}

function parseOjuzProblemData(
  html: string,
  problemID: string,
  url: string
): ProblemData | null {
  const document = cheerio.load(html);

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

async function fetchProblemDataOjuz(
  problemID: string
): Promise<ProblemData | null> {
  const url = buildOjuzUrl(problemID);
  const problemPage = await fetch(url);
  if (problemPage.status !== 200) {
    return null;
  }

  return parseOjuzProblemData(await problemPage.text(), problemID, url);
}

const MAX_TOTAL_SAMPLE_SIZE = 768 * 1024; // 768 KiB, as total Firestore doc max size is 1 MiB.
const MAX_SAMPLE_STDOUT_SIZE = 5000; // The execute server truncates stdout to 5000 bytes

const compareFilenames = (a: string, b: string): number => {
  const aMatch = a.match(/^(.*?)(\d+)?(\.[^.]*)?$/);
  const bMatch = b.match(/^(.*?)(\d+)?(\.[^.]*)?$/);

  const aPrefix = aMatch?.[1] ?? a;
  const bPrefix = bMatch?.[1] ?? b;

  const prefixResult = aPrefix.localeCompare(bPrefix);
  if (prefixResult !== 0) return prefixResult;

  const aNumber = aMatch?.[2] === undefined ? null : Number(aMatch[2]);
  const bNumber = bMatch?.[2] === undefined ? null : Number(bMatch[2]);

  if (aNumber !== bNumber) {
    if (aNumber === null) return -1;
    if (bNumber === null) return 1;
    return aNumber - bNumber;
  }

  const aExt = aMatch?.[3] ?? '';
  const bExt = bMatch?.[3] ?? '';

  const extResult = aExt.localeCompare(bExt);
  if (extResult !== 0) return extResult;

  return a.localeCompare(b);
};

// TODO: Add an API endpoint in njudge instead of scraping the HTML.
async function parseNjudgeProblemData(
  html: string,
  problemID: string,
  url: string
): Promise<ProblemData | null> {
  const document = cheerio.load(html);

  const titleHeading = document('div:contains("Cím:")');
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

  let samples: Sample[] = [];

  const attachmentURL = (filename: string) =>
    `https://njudge.hu/problemset/main/${problemID}/attachment/${filename}/`;

  const fetchAttachmentText = async (filename: string): Promise<string> => {
    const response = await fetch(attachmentURL(filename));
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${filename}: ${response.status} ${response.statusText}`
      );
    }

    return response.text();
  };

  // Biro/Mester tasks have their sample tests in a file called minta.zip.
  const sampleResponse = await fetch(attachmentURL('minta.zip'));
  if (sampleResponse.ok) {
    const zip = new AdmZip(Buffer.from(await sampleResponse.arrayBuffer()));
    for (const zipEntry of zip
      .getEntries()
      .sort((a, b) => compareFilenames(a.name, b.name))) {
      const match = zipEntry.name.match(/^be(\d+)\.txt$/);
      if (!match) continue;

      const outputEntry = zip.getEntry(`ki${match[1]}.txt`);
      if (!outputEntry) {
        console.warn(
          `Output file ki${match[1]}.txt not found in minta.zip for njudge ${problemID}`
        );
        continue;
      }

      samples.push({
        input: zipEntry.getData().toString('utf-8'),
        output: outputEntry.getData().toString('utf-8'),
      });
    }
  } else {
    // Some other tasks have separate attachments for each sample test.
    const attachmentFiles = document('div.card-header:contains("Mellékletek")')
      .next()
      .find('a')
      .map((_, el) => {
        const href = document(el).attr('href');
        return href ? (href.split('/').filter(Boolean).pop() ?? null) : null;
      })
      .filter((_, filename): filename is string => filename !== null)
      .toArray()
      .sort(compareFilenames);

    const attachmentSet = new Set(attachmentFiles);

    for (const filename of attachmentFiles) {
      const match = filename.match(/^(input|in|be)(\d+)\.txt$/);
      if (!match) continue;

      const sampleIndex = match[2];

      const outputFilename = [
        `output${sampleIndex}.txt`,
        `out${sampleIndex}.txt`,
        `ki${sampleIndex}.txt`,
      ].find(filename => attachmentSet.has(filename));

      if (!outputFilename) {
        console.warn(
          `No matching output file found for attachment ${filename} for njudge ${problemID}`
        );
        continue;
      }

      try {
        const [inputContents, outputContents] = await Promise.all([
          fetchAttachmentText(filename),
          fetchAttachmentText(outputFilename),
        ]);

        samples.push({ input: inputContents, output: outputContents });
      } catch (e) {
        console.warn(
          `Failed to fetch sample test files ${filename} and ${outputFilename} for njudge ${problemID}`,
          e
        );
      }
    }
  }

  samples = samples.filter(
    sample =>
      Buffer.byteLength(sample.output, 'utf-8') <= MAX_SAMPLE_STDOUT_SIZE
  );

  const sampleSize = (sample: Sample) =>
    Buffer.byteLength(sample.input, 'utf8') +
    Buffer.byteLength(sample.output, 'utf8');

  let totalSize = samples.reduce((sum, sample) => sum + sampleSize(sample), 0);

  while (totalSize > MAX_TOTAL_SAMPLE_SIZE && samples.length > 0) {
    let largestIndex = 0;
    let maxSampleSize = sampleSize(samples[0]);

    for (let i = 1; i < samples.length; i++) {
      const currentSize = sampleSize(samples[i]);
      if (currentSize > maxSampleSize) {
        largestIndex = i;
        maxSampleSize = currentSize;
      }
    }

    totalSize -= maxSampleSize;
    samples.splice(largestIndex, 1);
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
    samples,
    input: 'stdin',
    output: 'stdout',
    source: `njudge ${problemID}`,
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

  return parseNjudgeProblemData(await problemPage.text(), problemID, url);
}
