import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, list, ref } from 'firebase/storage';

const fetchProblemTestcasesHttpsCallable = httpsCallable<
  { platform: string; id: string; force: boolean },
  string
>(getFunctions(undefined, 'europe-west1'), 'fetchProblemTestcases');

// Note: This function uses the client SDK
// This function first checks if the given problem's testcases are cached
// if not, it calls the associated firebase function
export async function fetchProblemTestcases(
  platform: string,
  id: string,
  force: boolean
): Promise<string> {
  const storage = getStorage();
  const basePath = `testcases/${platform}/${id}`;
  const baseRef = ref(storage, basePath);

  const entries = await list(baseRef, { maxResults: 1 });
  const isAlreadyFetched = entries.items.length > 0;
  if (isAlreadyFetched && !force) {
    return 'Skipped';
  }

  try {
    const res = await fetchProblemTestcasesHttpsCallable({
      platform,
      id,
      force,
    });
    return res.data;
  } catch (e) {
    console.error(e);
    return 'Error';
  }
}
