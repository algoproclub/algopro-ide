import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';
import firebaseApp from '../../src/firebaseAdmin';

const db = getDatabase(firebaseApp);
const firestore = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

export const ensureUserdata = async (
  userID: string,
  initialName: string | null
) => {
  const userDocRef = firestore.doc(`userdata/${userID}`);
  await firestore.runTransaction(async tx => {
    const snap = await tx.get(userDocRef);

    if (!snap.exists || !snap.get('user_full_name')) {
      if (!initialName) {
        const user = await auth.getUser(userID);
        initialName = user.displayName ?? 'Unnamed User';
      }
      tx.set(userDocRef, { user_full_name: initialName }, { merge: true });
    }
    if (!snap.exists || !snap.get('groups')) {
      tx.set(userDocRef, { groups: [] }, { merge: true });
    }
    if (!snap.exists || !snap.get('schools')) {
      tx.set(userDocRef, { schools: [] }, { merge: true });
    }
  });
};

export const markUserRegistered = async (userID: string) => {
  const user = await auth.getUser(userID);
  const curClaims = user.customClaims ?? {};
  await auth.setCustomUserClaims(userID, { ...curClaims, registered: true });
};

export const addUserToSchool = async (userID: string, schoolID: string) => {
  const userDocRef = firestore.doc(`userdata/${userID}`);
  await userDocRef.set(
    { schools: FieldValue.arrayUnion(schoolID) },
    { merge: true }
  );

  const rtdbRef = db.ref(`users/${userID}/schools`);
  await rtdbRef.transaction(current => {
    if (Array.isArray(current)) {
      return current.includes(schoolID) ? current : [...current, schoolID];
    }
    return [schoolID];
  });
};
