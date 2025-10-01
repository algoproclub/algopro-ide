const useFirebaseEmulatorInDev = true;

export const SHOULD_USE_FIREBASE_EMULATOR =
  typeof window !== 'undefined' &&
  location.hostname === 'localhost' &&
  useFirebaseEmulatorInDev;
