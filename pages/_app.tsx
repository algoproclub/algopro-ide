import { AppProps } from 'next/app';
import Head from 'next/head';
import 'tailwindcss/tailwind.css';
import '../src/styles/globals.css';
import * as firebase from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { ConnectionProvider } from '../src/context/ConnectionContext';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import { UserProvider } from '../src/context/UserContext';
import { SHOULD_USE_FIREBASE_EMULATOR } from '../src/dev_constants';
import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import en from 'javascript-time-ago/locale/en';
import TimeAgo from 'javascript-time-ago';
import { TopNavBar } from '../src/components/TopNavBar';

TimeAgo.addDefaultLocale(en);

library.add(fas, far);

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

if (!firebase.getApps()?.length) {
  if (SHOULD_USE_FIREBASE_EMULATOR) {
    firebase.initializeApp({
      projectId: 'algopro-app',
      apiKey: 'fake-api-key',
      authDomain: '127.0.0.1:9099',
      databaseURL: 'http://127.0.0.1:9000/?ns=algopro-app-default-rtdb',
      storageBucket: 'algopro-app.appspot.com',
    });
    connectAuthEmulator(getAuth(), 'http://127.0.0.1:9099');
    connectDatabaseEmulator(getDatabase(), '127.0.0.1', 9000);
    connectFunctionsEmulator(
      getFunctions(undefined, 'europe-west1'),
      '127.0.0.1',
      5001
    );
    connectFirestoreEmulator(getFirestore(), '127.0.0.1', 8080);
    connectStorageEmulator(getStorage(), '127.0.0.1', 9199);
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
      <Head>
        <meta name="color-scheme" content="light dark" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>
      <Toaster position="bottom-right" />
      <UserProvider>
        <ConnectionProvider>
          <TopNavBar />
          <Component {...pageProps} />
        </ConnectionProvider>
      </UserProvider>
      <Analytics />
    </>
  );
}

export default MyApp;
