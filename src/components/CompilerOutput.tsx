import React from 'react';
import { DEFAULT_FONT_SIZE_EDITOR } from '../constants/editorConstants';
import { useUserContext } from '../context/UserContext';

/* eslint-disable no-control-regex */
const ERASE_LINE = '\x1b[K';
const SET_COLOR_REGEX = /\x1b\[([0-9;]*?)m/;
const HYPERLINK_REGEX = /\x1b\]8;;(?<url>.*?)\x07(?<text>.*?)\x1b\]8;;\x07/;
const LOCATION_REGEX = /^[^\s]+\.cpp:(?<line>\d+)(:(?<column>\d+))?/;

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

function parseOutputLine(line: string): {
  spans: JSX.Element[];
  linkedLine: number | undefined;
} {
  line = line.replaceAll(ERASE_LINE, '');
  const chunks = line.split(SET_COLOR_REGEX);
  let plaintext = '';
  const spans: JSX.Element[] = [];

  if (chunks[0] !== '') {
    spans.push(<span key={0}>{chunks[0]}</span>);
    plaintext += chunks[0];
  }
  for (let i = 1; i < chunks.length; i += 2) {
    const idx = Math.ceil(i / 2);
    const styles = chunks[i].split(';').map(n => STYLES[Number(n)] ?? {});
    const hyperlinkMatch = chunks[i + 1].match(HYPERLINK_REGEX);
    const text = hyperlinkMatch?.groups?.text ?? chunks[i + 1];
    plaintext += text;

    const content = hyperlinkMatch ? (
      <a href={hyperlinkMatch.groups?.url} target="_blank" rel="noreferrer">
        {text}
      </a>
    ) : (
      text
    );

    if (hyperlinkMatch) styles.push({ textDecoration: 'underline dotted' });

    spans.push(
      <span key={idx} style={Object.assign({}, ...styles)}>
        {content}
      </span>
    );
  }

  const locationMatch = plaintext.match(LOCATION_REGEX);
  return {
    spans,
    linkedLine: locationMatch ? Number(locationMatch.groups?.line) : undefined,
  };
}

const OutputLine = ({
  spans,
  linkedLine,
  highlightLine,
  clearLineHighlight,
}: {
  spans: JSX.Element[];
  linkedLine: number | undefined;
  highlightLine?: (line: number) => void;
  clearLineHighlight?: () => void;
}): JSX.Element => {
  if (linkedLine !== undefined && highlightLine) {
    return (
      <div
        className="terminal-linked-line"
        onMouseOver={() => highlightLine && highlightLine(linkedLine)}
        onMouseLeave={clearLineHighlight}
      >
        {spans}
      </div>
    );
  }

  return <div>{spans}</div>;
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
  const lines = output.split('\n').map(parseOutputLine);
  const {
    userData: { fontSize },
  } = useUserContext();

  return (
    <pre
      className="px-4 pt-2 h-full overflow-auto"
      style={{
        color: 'var(--color-terminal-foreground)',
        fontSize: `${fontSize ?? DEFAULT_FONT_SIZE_EDITOR}px`,
        lineHeight: `${(fontSize ?? DEFAULT_FONT_SIZE_EDITOR) / 0.75}px`,
      }}
    >
      {lines.map(({ spans, linkedLine }, idx) => (
        <OutputLine
          key={idx}
          spans={spans}
          linkedLine={linkedLine}
          highlightLine={highlightLine}
          clearLineHighlight={clearLineHighlight}
        />
      ))}
    </pre>
  );
};
