import { useState } from 'react';

export const useScopedSelection = (
  scopeKey: string | null,
  validIDs: string[],
  preferredID?: string | null
) => {
  const fallbackID =
    preferredID === null
      ? null
      : preferredID && validIDs.includes(preferredID)
        ? preferredID
        : (validIDs[0] ?? null);
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
