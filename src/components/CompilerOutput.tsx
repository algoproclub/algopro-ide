import React from 'react';

/* eslint-disable no-control-regex */
const ERASE_LINE = '\x1b[K';
const SET_COLOR_REGEX = /\x1b\[([0-9;]*?)m/;
const HYPERLINK_REGEX = /\x1b\]8;;(?<url>.*?)\x07(?<text>.*?)\x1b\]8;;\x07/;
const LOCATION_REGEX = /\w.cpp:(?<line>\d+):(?<column>\d*)/;

// prettier-ignore
const STYLES: Record<number, React.CSSProperties> = {
  0: {},
  1: { fontWeight: 'bold' },
  30: { color: 'var(--terminal-black)' },
  31: { color: 'var(--terminal-red)' },
  32: { color: 'var(--terminal-green)' },
  33: { color: 'var(--terminal-yellow)' },
  34: { color: 'var(--terminal-blue)' },
  35: { color: 'var(--terminal-magenta)' },
  36: { color: 'var(--terminal-cyan)' },
  37: { color: 'var(--terminal-white)' },
};

const OutputLine = ({
  line,
  highlightLine,
  clearLineHighlight,
}: {
  line: string;
  highlightLine?: (line: number) => void;
  clearLineHighlight?: () => void;
}): JSX.Element => {
  line = line.replaceAll(ERASE_LINE, '');
  const chunks = line.split(SET_COLOR_REGEX);

  const locationMatch = line.match(LOCATION_REGEX);
  const linkedLine = locationMatch ? Number(locationMatch.groups?.line) : null;

  const spans: JSX.Element[] = [];
  if (chunks[0] !== '') {
    spans.push(<span key={0}>{chunks[0]}</span>);
  }
  for (let i = 1; i < chunks.length; i += 2) {
    const idx = Math.ceil(i / 2);

    const styles = chunks[i].split(';').map(n => STYLES[Number(n)]);
    const hyperlinkMatch = chunks[i + 1].match(HYPERLINK_REGEX);

    const content = hyperlinkMatch ? (
      <a href={hyperlinkMatch.groups?.url} target="_blank">
        {hyperlinkMatch.groups?.text}
      </a>
    ) : (
      chunks[i + 1]
    );

    if (hyperlinkMatch) {
      styles.push({ textDecoration: 'underline dotted' });
    }

    spans.push(
      <span key={idx} style={Object.assign({}, ...styles)}>
        {content}
      </span>
    );
  }

  if (linkedLine !== null && highlightLine) {
    return (
      <div
        className="terminal-linked-line"
        onMouseOver={() => highlightLine && highlightLine(linkedLine)}
        onMouseLeave={clearLineHighlight}
      >
        {...spans}
      </div>
    );
  }

  return <div>{...spans}</div>;
};

export const CompilerOutput = ({
  output,
  highlightLine,
  clearLineHighlight,
}: {
  output: string;
  highlightLine?: (line: number) => void;
  clearLineHighlight?: () => void;
}): JSX.Element => {
  const lines = output.split('\n');

  return (
    <pre
      className="text-xs px-4 pt-2 h-full overflow-auto"
      style={{ color: 'var(--terminal-white)' }}
    >
      {lines.map((line, idx) => (
        <OutputLine
          key={idx}
          line={line}
          highlightLine={highlightLine}
          clearLineHighlight={clearLineHighlight}
        />
      ))}
    </pre>
  );
};
