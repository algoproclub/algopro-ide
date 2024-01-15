import { AppProps } from 'next/app';
import 'tailwindcss/tailwind.css';
import '../src/styles/globals.css';
import * as firebase from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { ConnectionProvider } from '../src/context/ConnectionContext';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import { UserProvider } from '../src/context/UserContext';
import { SHOULD_USE_FIREBASE_EMULATOR } from '../src/dev_constants';

const firebaseConfig = {
  apiKey: 'AIzaSyBYdZ07lyFBG6s8x2e06NUDCDmPh12AaX0',
  authDomain: 'algopro-app.firebaseapp.com',
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
      authDomain: 'localhost:9099',
      databaseURL: 'http://localhost:9000/?ns=algopro-app-default-rtdb',
    });
    connectAuthEmulator(getAuth(), 'http://localhost:9099');
    connectDatabaseEmulator(getDatabase(), 'localhost', 9000);
    connectFunctionsEmulator(getFunctions(), 'localhost', 5001);
  } else {
    firebase.initializeApp(firebaseConfig);
    if (typeof window !== 'undefined') {
      isSupported().then(result => {
        if (result) getAnalytics();
      });
    }
  }
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Toaster position="bottom-right" />
      <UserProvider>
        <ConnectionProvider>
          <Component {...pageProps} />
        </ConnectionProvider>
      </UserProvider>
      <Analytics />
    </>
  );
}

export default MyApp;
