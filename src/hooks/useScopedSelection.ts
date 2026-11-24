import { useState } from 'react';

/**
 * Resets the selection when the scope changes and clears it if it is no longer
 * valid. Defaults to the only valid ID, or to a valid `preferredID` when there
 * are multiple options.
 */
export const useScopedSelection = (
  scopeKey: string | null,
  validIDs: string[],
  preferredID?: string
) => {
  const fallbackID =
    validIDs.length === 1
      ? validIDs[0]
      : preferredID && validIDs.includes(preferredID)
        ? preferredID
        : null;

  const [selection, setSelection] = useState(() => ({
    scopeKey,
    selectedID: fallbackID,
  }));
  const selectedID =
    selection.scopeKey === scopeKey &&
    selection.selectedID &&
    validIDs.includes(selection.selectedID)
      ? selection.selectedID
      : fallbackID;

  // React applies this guarded update before rendering children. It records an
  // asynchronously resolved default without a second, effect-driven render.
  if (selection.scopeKey !== scopeKey || selection.selectedID !== selectedID)
    setSelection({ scopeKey, selectedID });

  return [
    selectedID,
    (id: string | null) => setSelection({ scopeKey, selectedID: id }),
  ] as const;
};
