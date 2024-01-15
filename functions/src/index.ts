import { onCall } from 'firebase-functions/v2/https';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { Sample } from '../../src/types/judge';
import { ElementType } from 'domelementtype';
import * as domhandler from 'domhandler';
import { PlatformProblem, ProblemData } from '../../src/types/problem';

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

export const fetchProblemData = onCall<
  PlatformProblem,
  Promise<ProblemData | null>
>(async request => {
  const platform = request.data.platform;
  const problemID = request.data.problemID;
  if (typeof platform !== 'string') {
    return null;
  }
  if (platform !== 'CF') {
    return null;
  }
  if (typeof problemID !== 'string') {
    return null;
  }
  const PROBLEM_REGEX = /(\d+)([A-Za-z]+)/;

  const matches = problemID.match(PROBLEM_REGEX);
  if (!matches) {
    return null;
  }

  const url = `https://codeforces.com/problemset/problem/${matches[1]}/${matches[2]}`;
  const problemPage = await fetch(url);
  if (!problemPage) {
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

  const statement = document('.problem-statement > :not([class])');
  const inputSpec = document('.problem-statement > .input-specification');
  const outputSpec = document('.problem-statement > .output-specification');

  return {
    id: problemID,
    submittable: true,
    platform,
    url,
    title: document('.header > .title').text(),
    statement: [statement, inputSpec, outputSpec]
      .map(el => el.html())
      .join('\n'),
    input: 'asdasdasd',
    output: 'XXXXXXx',
    source: 'WHAT IS THIS',
    samples,
  };
});
