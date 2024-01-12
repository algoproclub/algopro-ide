import { Sample } from './types';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

type Problem = {
  id: string;
  url: string;
  title: string;
  statement: string;
  samples: Sample[];
};

export async function fetchProblemData(
  problemId: string
): Promise<Problem | null> {
  const PROBLEM_REGEX = /(\w+)_(\w+)/;

  const matches = problemId.match(PROBLEM_REGEX);
  // TODO: Figure out error handling
  if (!matches) return null;

  const url = `https://atcoder.jp/contests/${matches[1]}/tasks/${problemId}`;
  const response = await fetch(url);
  if (!response) return null;

  const document = cheerio.load(await response.text());

  let samples: Sample[] = [];
  const inputs_and_outputs = document('#task-statement .lang-en > div')
    .filter((_, el) => document('h3', el).text().startsWith('Sample'))
    .map((_, el) => document('pre', el).text())
    .get();

  for (let i = 0; i < inputs_and_outputs.length; i += 2)
    samples.push({
      input: inputs_and_outputs[i],
      output: inputs_and_outputs[i + 1],
    });

  const title = document('span.h2')
    .first()
    .contents()
    .filter((_, el) => el.type === 'text')
    .text()
    .trim();

  const statement = document('#task-statement .lang-en > div')
    .filter((_, el) => !document('h3', el).text().startsWith('Sample'))
    .map((_, el) => document(el).html())
    .toArray()
    .join('\n');

  return {
    id: problemId,
    url,
    title,
    statement,
    samples,
  };
}

const p = await fetchProblemData('abc123_a');
console.log(p);
console.log(p.statement);
