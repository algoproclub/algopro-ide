import { AppProps } from 'next/app';
import 'tailwindcss/tailwind.css';
import '../src/styles/globals.css';
import * as firebase from 'firebase/app';
import {
  getDatabase,
  connectDatabaseEmulator,
  update,
  ref,
  get,
} from 'firebase/database';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { ConnectionProvider } from '../src/context/ConnectionContext';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import {
  useNullableUserContext,
  UserProvider,
} from '../src/context/UserContext';
import { SHOULD_USE_FIREBASE_EMULATOR } from '../src/dev_constants';
import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import { useEffect } from 'react';

library.add(fas, far);

const firebaseConfig = {
  apiKey: 'AIzaSyBYdZ07lyFBG6s8x2e06NUDCDmPh12AaX0',
  authDomain: 'algopro-app.firebaseapp.com',
  databaseURL:
    'https://algopro-app-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'algopro-app',
  storageBucket: 'algopro-app.appspot.com',
  messagingSenderId: '814731555768',
  appId: '1:814731555768:web:89691aa18c84f81472154d',
  measurementId: 'G-DW2XN13WS9',
};

if (!firebase.getApps()?.length) {
  if (SHOULD_USE_FIREBASE_EMULATOR) {
    firebase.initializeApp({
      ...firebaseConfig,
      authDomain: '127.0.0.1:9099',
      databaseURL: 'http://127.0.0.1:9000/?ns=algopro-app-default-rtdb',
    });
    connectAuthEmulator(getAuth(), 'http://127.0.0.1:9099');
    connectDatabaseEmulator(getDatabase(), '127.0.0.1', 9000);
    connectFunctionsEmulator(
      getFunctions(undefined, 'europe-west1'),
      '127.0.0.1',
      5001
    );
    connectFirestoreEmulator(getFirestore(), '127.0.0.1', 8080);
  } else {
    firebase.initializeApp(firebaseConfig);
    if (typeof window !== 'undefined') {
      isSupported().then(result => {
        if (result) getAnalytics();
      });
    }
  }
}

const ContextValueListener = ({ children }: { children: JSX.Element }) => {
  const { firebaseUser, userData } = useNullableUserContext();

  useEffect(() => {
    if (firebaseUser) {
      const userRef = ref(getDatabase(), `users/${firebaseUser.uid}`);
      get(userRef).then(userSnap => {
        if (!userSnap.val()?.role) {
          update(userRef, {
            role: 'student',
          });
        }
      });
    }
  }, [firebaseUser]);

  return <>{children}</>;
};

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Toaster position="bottom-right" />
      <UserProvider>
        <ConnectionProvider>
          <ContextValueListener>
            <Component {...pageProps} />
          </ContextValueListener>
        </ConnectionProvider>
      </UserProvider>
      <Analytics />
    </>
  );
}

export default MyApp;
