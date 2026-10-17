export const LSP_LANGUAGES = ['cpp', 'python'] as const;
export type LspLanguage = (typeof LSP_LANGUAGES)[number];
export type LspMode = 'local' | 'remote';
export type LspPreference = LspMode | null;
export type LspPreferences = Record<LspLanguage, LspPreference>;

const STORAGE_KEY = 'algopro-lsp-preferences-v1';
let pagePreferences: LspPreferences | undefined;

// These are deliberately centralized: the settings UI can explain what
// Default means without duplicating backend-selection policy.
export const DEFAULT_LSP_MODES: Record<LspLanguage, LspMode> = {
  cpp: 'remote',
  python: 'remote',
};

export function isLspLanguage(
  language: string | null | undefined
): language is LspLanguage {
  return LSP_LANGUAGES.some(supported => supported === language);
}

export const defaultLspPreferences = (): LspPreferences => ({
  cpp: null,
  python: null,
});

export function readLspPreferences(): LspPreferences {
  const preferences = defaultLspPreferences();
  if (typeof window === 'undefined') return preferences;

  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '{}'
    );
    if (typeof value !== 'object' || value === null) return preferences;
    for (const language of LSP_LANGUAGES) {
      const mode = (value as Record<string, unknown>)[language];
      if (mode === 'local' || mode === 'remote') {
        preferences[language] = mode;
      }
    }
  } catch {
    // A blocked or malformed localStorage value is equivalent to Default.
  }
  return preferences;
}

// Keep all editors on the same backend choices until the page is reloaded.
export function readPageLspPreferences(): Readonly<LspPreferences> {
  if (typeof window === 'undefined') return defaultLspPreferences();
  return (pagePreferences ??= readLspPreferences());
}

export function writeLspPreferences(preferences: LspPreferences): void {
  if (typeof window === 'undefined') return;
  const stored: Partial<Record<LspLanguage, LspMode>> = {};
  for (const language of LSP_LANGUAGES) {
    const preference = preferences[language];
    if (preference !== null) stored[language] = preference;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // The editor can continue with the current in-memory choice.
  }
}
