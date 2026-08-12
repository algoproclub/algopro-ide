#!/usr/bin/env node

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const reportPath = process.argv[2] || 'eslint-report.json';
const eventName = process.env.GITHUB_EVENT_NAME;
const base = process.env.DIFF_BASE;
const head = process.env.DIFF_HEAD || 'HEAD';
const mode = eventName === 'pull_request' ? '...' : '..';
const hasBase = base && !/^0{40}$/.test(base);
const range = hasBase ? `${base}${mode}${head}` : `${head}^..${head}`;

function normalize(filePath) {
  return filePath.split(path.sep).join('/');
}

function parseChangedRanges(diff) {
  const changed = new Map();
  let currentFile = null;

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const file = line.slice(4);
      currentFile =
        file === '/dev/null' ? null : file.replace(/^(?:b\/|new\/)/, '');
      continue;
    }

    if (!currentFile) continue;

    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!hunk) continue;

    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    if (count === 0) continue;

    const ranges = changed.get(currentFile) || [];
    ranges.push([start, start + count - 1]);
    changed.set(currentFile, ranges);
  }

  return changed;
}

function isChangedLine(changedRanges, filePath, line) {
  const ranges = changedRanges.get(filePath);
  return ranges?.some(([start, end]) => line >= start && line <= end) ?? false;
}

function getAnnotationProperties(filePath, message) {
  const startLine = message.line || 1;
  const endLine = message.endLine || startLine;
  const properties = {
    title: message.ruleId ? `ESLint: ${message.ruleId}` : 'ESLint',
    file: filePath,
    startLine,
    endLine,
  };

  if (startLine === endLine) {
    properties.startColumn = message.column || 1;
    properties.endColumn = message.endColumn || properties.startColumn;
  }

  return properties;
}

async function main() {
  const core = await import('@actions/core');
  const diff = execFileSync(
    'git',
    [
      '-c',
      'core.quotePath=false',
      'diff',
      '--unified=0',
      '--diff-filter=ACMRT',
      '--no-color',
      '--no-ext-diff',
      '--no-prefix',
      range,
      '--',
      'src',
      'pages',
    ],
    { encoding: 'utf8' }
  );
  const changedRanges = parseChangedRanges(diff);
  const results = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

  let errorCount = 0;
  let warningCount = 0;
  let shownCount = 0;
  let hiddenCount = 0;

  for (const result of results) {
    const relativePath = normalize(
      path.relative(process.cwd(), result.filePath)
    );

    for (const message of result.messages) {
      if (message.severity === 2) errorCount += 1;
      if (message.severity === 1) warningCount += 1;

      if (isChangedLine(changedRanges, relativePath, message.line || 1)) {
        const properties = getAnnotationProperties(relativePath, message);

        if (message.severity === 2) {
          core.error(message.message, properties);
        } else {
          core.warning(message.message, properties);
        }

        shownCount += 1;
      } else {
        hiddenCount += 1;
      }
    }
  }

  const summary =
    `ESLint found ${errorCount} errors and ${warningCount} warnings; ` +
    `${shownCount} diagnostics are in changed ranges and ${hiddenCount} are outside changed ranges.`;

  core.info(summary);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await core.summary
      .addHeading('ESLint')
      .addTable([
        [
          { data: 'Errors', header: true },
          { data: 'Warnings', header: true },
          { data: 'Shown', header: true },
          { data: 'Hidden', header: true },
          { data: 'Range', header: true },
        ],
        [
          String(errorCount),
          String(warningCount),
          String(shownCount),
          String(hiddenCount),
          range,
        ],
      ])
      .write();
  }

  if (errorCount > 0) {
    core.setFailed(`ESLint found ${errorCount} errors.`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
