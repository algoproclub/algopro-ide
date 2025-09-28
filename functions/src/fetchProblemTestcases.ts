import { Database } from 'firebase-admin/database';
import AdmZip from 'adm-zip';
import type { Bucket } from '@google-cloud/storage';

export async function fetchProblemTestcases(
  db: Database,
  bucket: Bucket,
  platform: string,
  id: string,
  force: boolean
): Promise<string> {
  if (platform.includes('/') || id.includes('/')) {
    return 'Bad arguments';
  }

  const basePath = `testcases/${platform}/${id}`;

  const filesResp = await bucket.getFiles({ prefix: basePath, maxResults: 1 });
  const isAlreadyFetched = filesResp[0].length > 0;

  if (isAlreadyFetched) {
    if (force) {
      console.debug('some files already exist, deleting');
      await bucket.deleteFiles({ prefix: basePath });
    } else {
      console.debug('some files already exist, skipping');
      return 'Skipped (on backend)';
    }
  }

  if (platform === 'cses') {
    await fetchCSESProblemTestcases(db, bucket, basePath, id);
    return 'Fetched';
  } else {
    console.warn(
      `Trying to fetch testcases from ${platform}, but it doesn't currently have a testcase fetcher`
    );
    return 'No fetcher';
  }
}

async function fetchCSESProblemTestcases(
  db: Database,
  bucket: Bucket,
  basePath: string,
  id: string
) {
  const accountRef = await db.ref(`credentials/cses/0`).get();
  if (!accountRef.exists()) {
    console.warn(
      `Trying to fetch testcases from cses, but no credentials are present in the database`
    );
    return;
  }

  const account = accountRef.val();
  const csrf_token: string = account.csrf_token;
  const cookie: string = account.cookie;

  const res = await fetch(`https://cses.fi/problemset/tests/${id}/`, {
    method: 'POST',
    headers: {
      cookie: cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      csrf_token: csrf_token,
      download: 'true',
    }),
  });

  if (!res.ok) {
    console.warn(
      'Testcase fetching from CSES failed, because reponse was not OK!'
    );
    return;
  }

  const arrayBuffer = await res.arrayBuffer();
  const zipfile = new AdmZip(Buffer.from(arrayBuffer));

  for (const entry of zipfile.getEntries()) {
    const regex = /(\d+)\.(in|out)/;
    const matchArray = regex.exec(entry.name);
    if (matchArray === null) {
      console.warn(`"${entry.name}" did not match expected regex! Ignoring.`);
      continue;
    }

    // the testcases are 1-indexed, but we store them 0-indexed
    const num = parseInt(matchArray[1]) - 1;
    const kind = matchArray[2] === 'in' ? 'input' : 'output';
    const saveFilename = `${basePath}/${kind}${num}.txt`;
    const data = await getEntryDataAsync(entry);
    await bucket.file(saveFilename).save(data);
  }
}

function getEntryDataAsync(entry: AdmZip.IZipEntry): Promise<Buffer> {
  return new Promise<Buffer>((res, rej) =>
    entry.getDataAsync((buf, err) => {
      if (err) rej(err);
      else res(buf);
    })
  );
}
