import { parse as parseToml, TomlTable, TomlValue } from 'smol-toml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import { ProblemData } from '../types/problem';
import { Sample } from '../types/judge';
import { buildYosupoUrl } from './problemUtils';

const YOSUPO_API_BASE = 'https://v3.api.judge.yosupo.jp';
const YOSUPO_STORAGE_BASE =
  'https://storage.googleapis.com/v2-prod-library-checker-data-public';

type YosupoProblemMetadata = {
  overall_version: string;
  testcases_version: string;
  time_limit: number;
  title: string;
};

type YosupoInfo = {
  params: Record<string, bigint>;
  tests: { name: string; number: number }[];
  timelimit?: number;
  title?: string;
};

const YOSUPO_KEYWORDS: Record<string, string> = {
  statement: 'Problem Statement',
  constraints: 'Constraints',
  input: 'Input',
  output: 'Output',
  sample: 'Sample',
  samples: 'Samples',
  note: 'Note',
  notes: 'Notes',
};

function buildFileUrl(
  problemID: string,
  metadata: YosupoProblemMetadata,
  filename: string
) {
  return `${YOSUPO_STORAGE_BASE}/v4/files/${problemID}/${metadata.overall_version}/${problemID}/${filename}`;
}

function buildExampleUrl(
  problemID: string,
  metadata: YosupoProblemMetadata,
  kind: 'in' | 'out',
  exampleName: string
) {
  return `${YOSUPO_STORAGE_BASE}/v4/examples/${problemID}/${metadata.testcases_version}/${kind}/${exampleName}.${kind}`;
}

async function fetchText(url: string): Promise<string | null> {
  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`Failed to fetch ${url}: ${response.status}`);
    return null;
  }
  return await response.text();
}

function trimTrailingNewlines(value: string) {
  return value.replace(/[\r\n]+$/, '');
}

function asTable(value: TomlValue | undefined): TomlTable | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as TomlTable)
    : null;
}

function asNumber(value: TomlValue | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function asString(value: TomlValue | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asIntegerBigInt(value: TomlValue | undefined): bigint | undefined {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) {
    return BigInt(value);
  }
  return undefined;
}

function parseYosupoInfoToml(raw: string): YosupoInfo {
  const parsed = parseToml(raw);
  const paramsTable = asTable(parsed.params);
  const testsArray = Array.isArray(parsed.tests) ? parsed.tests : [];

  const params = Object.fromEntries(
    Object.entries(paramsTable ?? {}).flatMap(([key, value]) => {
      const parsedValue = asIntegerBigInt(value);
      return parsedValue === undefined ? [] : [[key, parsedValue]];
    })
  );

  const tests = testsArray.flatMap(test => {
    const testTable = asTable(test);
    if (!testTable) return [];

    const name = asString(testTable.name);
    const number = asNumber(testTable.number);
    return name && typeof number === 'number' ? [{ name, number }] : [];
  });

  return {
    params,
    tests,
    ...(asString(parsed.title) ? { title: asString(parsed.title) } : {}),
    ...(asNumber(parsed.timelimit) !== undefined
      ? { timelimit: asNumber(parsed.timelimit) }
      : {}),
  };
}

function formatParam(value: bigint) {
  if (value === 0n) return '0';

  let powerOfTwoValue = value + 1n;
  let powerOfTwoExponent = 0;
  while (powerOfTwoValue > 1n && powerOfTwoValue % 2n === 0n) {
    powerOfTwoValue /= 2n;
    powerOfTwoExponent += 1;
  }
  if (powerOfTwoValue === 1n && powerOfTwoExponent >= 20) {
    return `2^{${powerOfTwoExponent}} - 1`;
  }

  if (value % 100_000n === 0n) {
    let power = 5n;
    while (value % 10n ** (power + 1n) === 0n) {
      power += 1n;
    }
    const coefficient = value / 10n ** power;
    return coefficient === 1n
      ? `10^{${power}}`
      : `${coefficient} \\times 10^{${power}}`;
  }

  return value.toString();
}

function keywordLabel(key: string) {
  return (
    YOSUPO_KEYWORDS[key] ??
    key
      .split(/[_\s]+/)
      .filter(Boolean)
      .map(part => part[0].toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function renderYosupoMarkdown(
  markdown: string,
  params: Record<string, bigint>,
  examples: Record<string, Sample>
) {
  const output: string[] = [];
  let activeLang: string | null = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    const langMatch = trimmed.match(/^@{lang\.([A-Za-z0-9_]+)}$/);
    if (langMatch) {
      activeLang = langMatch[1] === 'end' ? null : langMatch[1].toLowerCase();
      continue;
    }

    if (activeLang && activeLang !== 'en') {
      continue;
    }

    const exampleMatch = trimmed.match(/^@{example\.([A-Za-z0-9_]+)}$/);
    if (exampleMatch) {
      const sample = examples[exampleMatch[1]];
      if (!sample) {
        output.push(`_Sample ${exampleMatch[1]} is unavailable._`);
        continue;
      }

      output.push('```');
      output.push(sample.input);
      output.push('```');
      output.push('');
      output.push('```');
      output.push(sample.output);
      output.push('```');
      continue;
    }

    const line = rawLine
      .replace(/@{keyword\.([A-Za-z0-9_]+)}/g, (_, key: string) =>
        keywordLabel(key.toLowerCase())
      )
      .replace(/@{param\.([A-Za-z0-9_]+)}/g, (_, key: string) =>
        params[key] === undefined ? key : formatParam(params[key])
      );

    output.push(line);
  }

  return output.join('\n');
}

async function markdownToHtml(markdown: string) {
  const result = await unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(markdown);

  return result.toString();
}

async function fetchSamples(
  problemID: string,
  metadata: YosupoProblemMetadata,
  info: YosupoInfo
): Promise<{ examples: Record<string, Sample>; samples: Sample[] }> {
  const exampleCount =
    info.tests.find(test => test.name === 'example.in')?.number ?? 0;
  const examples: Record<string, Sample> = {};
  const samples: Sample[] = [];

  for (let index = 0; index < exampleCount; index++) {
    const name = `example_${index.toString().padStart(2, '0')}`;
    const [inputRaw, outputRaw] = await Promise.all([
      fetchText(buildExampleUrl(problemID, metadata, 'in', name)),
      fetchText(buildExampleUrl(problemID, metadata, 'out', name)),
    ]);

    if (inputRaw === null || outputRaw === null) {
      continue;
    }

    const sample = {
      input: trimTrailingNewlines(inputRaw),
      output: trimTrailingNewlines(outputRaw),
    };
    examples[name] = sample;
    samples.push(sample);
  }

  return { examples, samples };
}

export async function fetchProblemDataYosupo(
  problemID: string
): Promise<ProblemData | null> {
  const metadataResponse = await fetch(
    `${YOSUPO_API_BASE}/problems/${problemID}`
  );
  if (!metadataResponse.ok) {
    return null;
  }

  const metadata = (await metadataResponse.json()) as YosupoProblemMetadata;
  const [taskMd, infoToml] = await Promise.all([
    fetchText(buildFileUrl(problemID, metadata, 'task.md')),
    fetchText(buildFileUrl(problemID, metadata, 'info.toml')),
  ]);

  if (!taskMd) {
    return null;
  }

  const info: YosupoInfo = infoToml
    ? parseYosupoInfoToml(infoToml)
    : { params: {}, tests: [] };
  const { examples, samples } = await fetchSamples(problemID, metadata, info);
  const statementMarkdown = renderYosupoMarkdown(taskMd, info.params, examples);

  return {
    id: problemID,
    submittable: false,
    platform: 'yosupo',
    url: buildYosupoUrl(problemID),
    title: info.title ?? metadata.title,
    statement: await markdownToHtml(statementMarkdown),
    input: 'stdin',
    output: 'stdout',
    source: `Yosupo Library Checker ${problemID}`,
    timeLimit: `${info.timelimit ?? metadata.time_limit}s`,
    templateCode: null,
    samples,
  };
}
