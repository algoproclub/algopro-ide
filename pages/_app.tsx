import { AppProps } from 'next/app';
import { SettingsProvider } from '../src/components/SettingsContext';
import { WorkspaceInitializer } from '../src/components/WorkspaceInitializer';
import 'tailwindcss/tailwind.css';
import '../src/styles/globals.css';
import '../src/styles/firepad.css';
import firebase from 'firebase/app';
import 'firebase/database';
import 'firebase/auth';
import 'firebase/analytics';
import { ConnectionProvider } from '../src/context/ConnectionContext';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: 'planets-prog.firebaseapp.com',
  databaseURL: 'https://planets-prog-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'planets-prog',
  storageBucket: 'planets-prog.appspot.com',
  messagingSenderId: '858825023192',
  appId: '1:858825023192:web:da967b9566bd204010c1ad',
  // measurementId: 'G-G22TZ5YCKV',
};

if (typeof window !== 'undefined') {
  // firepad needs access to firebase
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.firebase = firebase;
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const shouldUseEmulator =
  typeof window !== 'undefined' && location.hostname === 'localhost' && false;

if (!firebase.apps?.length) {
  if (shouldUseEmulator) {
    firebase.initializeApp({
      ...firebaseConfig,
      authDomain: 'localhost:9099',
      databaseURL: 'http://localhost:9000/?ns=cp-ide-default-rtdb',
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
      <ConnectionProvider>
        <WorkspaceInitializer>
          <SettingsProvider>
            <Component {...pageProps} />
          </SettingsProvider>
        </WorkspaceInitializer>
      </ConnectionProvider>
      <Analytics />
    </>
  );
}

export default MyApp;
