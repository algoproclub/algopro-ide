// Complete the Navigation API types missing from the installed DOM definitions.
interface Navigation {
  readonly currentEntry: NavigationHistoryEntry | null;
}

interface Window {
  readonly navigation: Navigation;
}
