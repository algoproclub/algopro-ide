import { AppProps } from 'next/app';
import 'tailwindcss/tailwind.css';
import '../src/styles/globals.css';
import firebase from 'firebase/app';
import 'firebase/database';
import 'firebase/auth';
import 'firebase/analytics';
import { ConnectionProvider } from '../src/context/ConnectionContext';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import { UserProvider } from '../src/context/UserContext';
import { SHOULD_USE_FIREBASE_EMULATOR } from '../src/dev_constants';
import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';

library.add(fas);

const firebaseConfig = {
  apiKey: 'AIzaSyDR-XvtT4_GYPAUslb-JTdueV68SfsERec',
  authDomain: 'planets-prog.firebaseapp.com',
  databaseURL:
    'https://algopro-app-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'planets-prog',
  storageBucket: 'planets-prog.appspot.com',
  messagingSenderId: '858825023192',
  appId: '1:858825023192:web:da967b9566bd204010c1ad',
  // measurementId: 'G-G22TZ5YCKV',
};

if (!firebase.apps?.length) {
  if (SHOULD_USE_FIREBASE_EMULATOR) {
    firebase.initializeApp({
      ...firebaseConfig,
      authDomain: 'localhost:9099',
      databaseURL: 'http://localhost:9000/?ns=algopro-app-default-rtdb',
    });
    firebase.auth().useEmulator('http://localhost:9099');
    firebase.database().useEmulator('localhost', 9000);
  } else {
    firebase.initializeApp(firebaseConfig);
    if (typeof window !== 'undefined' && firebase.analytics) {
      firebase.analytics();
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
