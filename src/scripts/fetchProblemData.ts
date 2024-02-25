import { PlatformProblem, ProblemData } from '../types/problem';
import { Sample } from '../types/judge';
import { ElementType } from 'domelementtype';
import * as domhandler from 'domhandler';
import * as cheerio from 'cheerio';

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
    default:
      throw new Error(`platform '${platform}' is unimplemented`);
  }
}

async function fetchProblemDataCodeforces(
  problemID: string
): Promise<ProblemData | null> {
  const matches = problemID.match(CODEFORCES_PROBLEM_REGEX);
  if (!matches) {
    return null;
  }

  const url = `https://codeforces.com/contest/${matches[1]}/problem/${matches[2]}`;
  const problemPage = await fetch(url);
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

  return {
    id: problemID,
    submittable: true,
    platform: 'codeforces',
    url,
    title: document('.header > .title')
      .text()
      .match(CODEFORCES_TITLE_REGEX)![1],
    statement: document('.problem-statement > :not(.sample-tests, .header)')
      .map((_, el) => document(el).html())
      .toArray()
      .join('\n'),
    input: 'stdin',
    output: 'stdout',
    source: `Codeforces ${problemID}`,
    timeLimit: getTextNode(document('.time-limit')),
    memoryLimit: getTextNode(document('.memory-limit')),
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
    .filter((_, el) => !document('h3', el).text().startsWith('Sample'))
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

  // Fix up relative URLs to point to the cses.fi domain
  document('img').each((_, el) => {
    const src = document(el).attr('src');
    if (src && src.startsWith('/')) {
      document(el).attr('src', `https://cses.fi${src}`);
    }
  });

  const sections: { heading: string | null; children: domhandler.Element[] }[] =
    [{ heading: null, children: [] }];
  for (const el of document('.md').first().children()) {
    if (el.type === ElementType.Tag && el.tagName === 'h1') {
      sections.push({ heading: document(el).text(), children: [el] });
    } else {
      sections[sections.length - 1].children.push(el);
    }
  }

  const inputsAndOutputs: string[] | undefined = sections
    .find(s => s.heading === 'Example')
    ?.children.filter(el => el.type === ElementType.Tag && el.tagName === 'pre')
    .map(htmlToPlaintext);

  let samples: Sample[] = inputsAndOutputs
    ? [{ input: inputsAndOutputs[0], output: inputsAndOutputs[1] }]
    : [];

  return {
    id: problemID,
    submittable: true,
    platform: 'cses',
    url,
    title: document('.title-block > h1').text(),
    statement: sections
      .filter(s => s.heading !== 'Example')
      .map(s => s.children.map(c => document(c).prop('outerHTML')).join('\n'))
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
  };
}
