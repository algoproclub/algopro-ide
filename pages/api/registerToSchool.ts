import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import firebaseApp from '../../src/firebaseAdmin';

const db = getDatabase(firebaseApp);
const firestore = getFirestore(firebaseApp);

export const registerToSchool = async (userID: string, schoolID: string) => {
  const rtdbRef = db.ref(`users/${userID}/schools`);
  await rtdbRef.transaction(current => {
    if (Array.isArray(current)) {
      return current.includes(schoolID) ? current : [...current, schoolID];
    }
    return [schoolID];
  });

  const userDocRef = firestore.doc(`userdata/${userID}`);
  await userDocRef.set(
    { schools: FieldValue.arrayUnion(schoolID) },
    { merge: true }
  );
};
