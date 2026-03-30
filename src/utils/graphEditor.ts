export type ParsedGraph = {
  n: number;
  m: number;
  edges: [number, number][];
};

export const GRAPH_EDITOR_URL =
  'https://algoproclub.github.io/algopro-graph-editor/view';

const isPositiveInt = (num: number) =>
  Number.isInteger(num) && Number.isFinite(num) && num > 0;

export function parseGraphInput(raw: string): ParsedGraph {
  // Parse space-separated graph input, accept optional "n m" header, validate pairs.
  const tokens = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(val => Number(val));

  if (tokens.length === 0) {
    throw new Error('Provide at least one edge.');
  }

  let edgesTokens = tokens;
  let hasHeader = false;
  let headerN = 0;
  let headerM = 0;

  if (tokens.length >= 2) {
    const maybeN = tokens[0];
    const maybeM = tokens[1];
    const rest = tokens.slice(2);

    if (
      isPositiveInt(maybeN) &&
      Number.isInteger(maybeM) &&
      maybeM >= 0 &&
      rest.length === maybeM * 2
    ) {
      let restValid = true;
      let restMaxNode = 0;
      for (let i = 0; i < rest.length; i += 2) {
        const u = rest[i];
        const v = rest[i + 1];
        if (!isPositiveInt(u) || !isPositiveInt(v)) {
          restValid = false;
          break;
        }
        restMaxNode = Math.max(restMaxNode, u, v);
      }
      const headerHasEnoughNodes =
        rest.length === 0 ? maybeN > 0 : maybeN >= restMaxNode;
      if (restValid && headerHasEnoughNodes) {
        hasHeader = true;
        headerN = maybeN;
        headerM = maybeM;
        edgesTokens = rest;
      }
    }
  }

  if (!hasHeader && edgesTokens.length < 2) {
    throw new Error('Provide at least one edge.');
  }

  if (edgesTokens.length % 2 !== 0) {
    throw new Error('Edges must be provided in pairs.');
  }

  const edges: [number, number][] = [];
  let maxNode = 0;
  for (let i = 0; i < edgesTokens.length; i += 2) {
    const u = edgesTokens[i];
    const v = edgesTokens[i + 1];
    if (!isPositiveInt(u) || !isPositiveInt(v)) {
      throw new Error('Edge endpoints must be positive integers.');
    }
    if (hasHeader && (u > headerN || v > headerN)) {
      throw new Error('Edge endpoint exceeds n.');
    }
    edges.push([u, v]);
    maxNode = Math.max(maxNode, u, v);
  }

  if (!hasHeader && maxNode === 0) {
    throw new Error('Provide at least one node.');
  }

  const resultN = hasHeader ? headerN : maxNode;
  const resultM = hasHeader ? headerM : edges.length;

  if (hasHeader && edges.length !== headerM) {
    throw new Error(
      `Edge count mismatch (expected: ${headerM}, got: ${edges.length}).`
    );
  }

  return { n: resultN, m: resultM, edges };
}

export function stripGraphHeader(raw: string): string {
  // Drop leading "n m" header if present; keep input untouched otherwise.
  const lines = raw
    .trim()
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return raw;

  const header = lines[0].split(/\s+/).map(Number);
  if (
    header.length === 2 &&
    Number.isInteger(header[0]) &&
    Number.isInteger(header[1]) &&
    header[0] > 0 &&
    header[1] >= 0 &&
    lines.length - 1 >= header[1]
  ) {
    return lines.slice(1).join('\n');
  }

  return raw;
}

export function buildGraphEditorPayload(parsed: ParsedGraph): string {
  // Convert parsed edges into newline "u v" rows.
  return parsed.edges.map(([u, v]) => `${u} ${v}`).join('\n');
}

const decodeHtml = (value: string): string =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');

export function extractExampleInputFromStatement(
  statementHtml: string
): string | null {
  // Pull the example input <pre> block from the statement HTML if possible.
  if (!statementHtml.trim()) return null;

  if (typeof window !== 'undefined' && 'DOMParser' in window) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(statementHtml, 'text/html');
    const headers = Array.from(doc.querySelectorAll('h3'));
    const exampleHeader = headers.find(
      header => header.textContent?.trim().toLowerCase() === 'example'
    );
    if (exampleHeader) {
      let sawInputLabel = false;
      let node = exampleHeader.nextElementSibling;
      while (node) {
        const tag = node.tagName.toLowerCase();
        if (tag === 'p' && node.textContent?.toLowerCase().includes('input')) {
          sawInputLabel = true;
        }
        if (tag === 'pre') {
          if (sawInputLabel || !node.previousElementSibling) {
            return node.textContent?.trim() ?? null;
          }
        }
        node = node.nextElementSibling;
      }
    }
  }

  const match = statementHtml.match(
    /<h3[^>]*>\s*Example\s*<\/h3>[\s\S]*?<pre>([\s\S]*?)<\/pre>/i
  );
  if (!match) return null;
  const raw = match[1].replace(/<[^>]+>/g, '');
  return decodeHtml(raw).trim() || null;
}

export function buildGraphEditorUrlFromStatement(
  statementHtml: string
): string | null {
  // Try to extract + parse example input and produce a graph editor URL.
  const input = extractExampleInputFromStatement(statementHtml);
  if (!input) return null;
  try {
    return buildGraphEditorUrlFromRaw(input);
  } catch {
    return null;
  }
}

export function tryBuildPayloadFromRaw(raw: string): string | null {
  // Safe wrapper
  try {
    const parsed = parseGraphInput(raw);
    return buildGraphEditorPayload(parsed);
  } catch {
    return null;
  }
}

export function buildGraphEditorUrl(parsed: ParsedGraph): string {
  // Build graph editor URL
  const params = new URLSearchParams();
  parsed.edges.forEach(([u, v]) => {
    params.append('edges', `${u}-${v}`);
  });
  return `${GRAPH_EDITOR_URL}?${params.toString()}`;
}

export function buildGraphEditorUrlFromRaw(raw: string): string {
  // Parse raw input and gives a graph editor-c URL (throw if invalid).
  const parsed = parseGraphInput(raw);
  return buildGraphEditorUrl(parsed);
}
