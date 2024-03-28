const useFirebaseEmulatorInDev = true;
const useYjsDevSerInDev = true; //TODO: configure this better

export const SHOULD_USE_FIREBASE_EMULATOR =
  typeof window !== 'undefined' &&
  location.hostname === 'localhost' &&
  useFirebaseEmulatorInDev;
export const SHOULD_USE_DEV_YJS_SERVER =
  (process.env.NODE_ENV !== 'production' && useYjsDevSerInDev) ||
  process.env.IS_TEST_ENV;
export const SHOULD_USE_DEV_EXECUTE_SERVER =
  process.env.NODE_ENV !== 'production';
