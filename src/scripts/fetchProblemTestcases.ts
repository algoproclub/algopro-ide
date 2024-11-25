import { getStorage } from 'firebase-admin/storage';
import AdmZip from 'adm-zip';
import firebaseApp from '../../src/firebaseAdmin';
import { PlatformProblem } from '../types/problem';

function getEntryDataAsync(entry: AdmZip.IZipEntry): Promise<Buffer> {
  return new Promise<Buffer>((res, rej) =>
    entry.getDataAsync((buf, err) => {
      if (err) rej(err);
      else res(buf);
    })
  );
}

export async function fetchProblemTestcases({
  platform,
  id,
}: PlatformProblem): Promise<void> {
  if (platform !== 'cses') {
    console.warn(
      `Trying to fetch testcases from ${platform}, but it doesn't have a testcase fetcher yet`
    );
    return;
  }

  const basePath = `testcases/cses/${id}`;

  const bucket = getStorage(firebaseApp).bucket();

  // TODO: check if already cached

  const res = await fetch(`https://cses.fi/problemset/tests/${id}/`, {
    method: 'POST',
    headers: {
      cookie: 'PHPSESSID=dummy',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'csrf_token=dummy&download=true',
  });
  const arrayBuffer = await res.arrayBuffer();
  const zipfile = new AdmZip(Buffer.from(arrayBuffer));
  for (const entry of zipfile.getEntries()) {
    console.log(entry);
    const regex = /(\d+)\.(in|out)/;
    const matchArray = regex.exec(entry.name);
    if (matchArray === null) {
      console.warn(`"${entry.name}" did not match expected regex! Ignoring.`);
      continue;
    }
    const num = matchArray[1];
    const kind = matchArray[2] === 'in' ? 'input' : 'output';
    const saveFilename = `${basePath}/${kind}${num}.txt`;
    let data = await getEntryDataAsync(entry);
    await bucket.file(saveFilename).save(data);
  }
}
