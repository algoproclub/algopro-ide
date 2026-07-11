/**
 * Client-side configuration for the AI "Debug" feature. These are the knobs a
 * maintainer is most likely to want to tweak; the full rationale and the
 * server-side knobs are documented in docs/DEBUG_FEATURE.md.
 */
export const debugClientConfig = {
  /** Label shown on the Debug button. */
  buttonLabel: 'AI Help',
  /**
   * When true, hovering a highlighted line — or its red glyph-margin dot — shows
   * the AI's per-line reason. Lines are always highlighted red; the reason only
   * appears on hover. Set false to show the generic message below instead.
   */
  showReasons: true,
  /** Hover tooltip shown on highlighted lines when showReasons is false. */
  genericHoverMessage: 'The AI thinks this line may contain a bug.',
  /**
   * Toast after a run that flagged lines; {count} is replaced by the number of
   * highlighted lines. (The AI's free-text summary is deliberately NOT shown —
   * it is still returned by the API and kept in the server audit log.)
   */
  linesHighlightedMessage:
    'The AI highlighted {count} line(s) — hover them to see why.',
  /** Shown when the AI flags no lines: the code looks correct. */
  noIssuesMessage: 'The AI found no issues — the code looks correct.',
} as const;
