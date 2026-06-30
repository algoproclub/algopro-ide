/**
 * Client-side configuration for the AI "Debug" feature. These are the knobs a
 * maintainer is most likely to want to tweak; the full rationale and the
 * server-side knobs are documented in docs/DEBUG_FEATURE.md.
 */
export const debugClientConfig = {
  /** Label shown on the Debug button. */
  buttonLabel: 'Hibakeresés',
  /**
   * When true, hovering a highlighted line — or its red glyph-margin dot — shows
   * the AI's per-line reason. Lines are always highlighted red; the reason only
   * appears on hover. Set false to show the generic message below instead.
   */
  showReasons: true,
  /** Hover tooltip shown on highlighted lines when showReasons is false. */
  genericHoverMessage: 'Az AI szerint ezen a soron hiba lehet.',
  /** Shown when the AI reports no issues at all (no lines and no overall note). */
  noIssuesMessage: 'Az AI nem talált megjelölendő hibát a kódban.',
} as const;
