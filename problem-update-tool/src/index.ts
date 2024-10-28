import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as cheerio from 'cheerio';

function process(html: string) {
  const document = cheerio.load(html);
  let changed = false;
  document('img').each((_, element) => {
    document(element).attr('referrerpolicy', 'no-referrer');
    changed = true;
  });
  return changed ? document('body').html() : null;
}
async function main() {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: 'algopro-app',
  });

  const firestore = getFirestore(app);
  const problemsets = firestore.collection('problemsets/codeforces/problems');
  const snapshot = await problemsets.get();

  for (const doc of snapshot.docs) {
    const result = process(doc.data().statement);
    if (result != null) {
      console.log('Updating ' + doc.id);
      await problemsets.doc(doc.id).update({ statement: result });
    }

    const hungarian = firestore.doc(
      `problemsets/codeforces/problems/${doc.id}/translations/hu`
    );
    const translationSnapshot = await hungarian.get();
    if (translationSnapshot.exists) {
      const result = process(translationSnapshot.data().statement);
      if (result != null) {
        console.log('Updating ' + doc.id + '/translations/hu');
        await hungarian.update({ statement: result });
      }
    }
  }
}

// To run this, set the GOOGLE_APPLICATION_CREDENTIALS environment
// variable to the path of the service account key file.

main();
