import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  User,
  onAuthStateChanged,
  getAuth,
  updateProfile,
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  DataSnapshot,
  onValue,
  update,
} from 'firebase/database';

import animals from '../scripts/animals';
import { Platform } from '../types/problem';
import defaultCode from '../scripts/defaultCode';
import { DEFAULT_FONT_SIZE_EDITOR } from '../constants/editorConstants';

export type Language = 'cpp' | 'java' | 'py';

export const LANGUAGES: { label: string; value: Language }[] = [
  {
    label: 'C++',
    value: 'cpp',
  },
  {
    label: 'Java',
    value: 'java',
  },
  {
    label: 'Python',
    value: 'py',
  },
];

export type EditorMode = 'Normal' | 'Vim';
export type UsernameData = Partial<Record<Platform, string>>;
export type TemplateCodeData = Partial<Record<Language, string>>;

export type UserData = {
  id: string;
  editorMode: EditorMode;
  tabSize: number;
  fontSize: number;
  lightMode: boolean;
  rainbowIndent: boolean;
  defaultPermission: 'READ_WRITE' | 'READ' | 'PRIVATE';
  defaultLanguage: Language;
  manualSubmission: boolean;
  discordID: string;
  usernames: UsernameData;
  templateCode: TemplateCodeData;
};

export type UserRole = {
  admin?: boolean;
  teacher?: string[];
};

export type UserContextType = {
  firebaseUser: User | null;
  userData: UserData | null;
  userRole: UserRole | null;
  registered: boolean | null;
  logged: boolean | null;
  /**
   * Updates firebaseUser.displayName. Normally doing this doesn't trigger rerender
   * so use this function, which will force a UI rerender
   * @param username The new value of firebaseUser.displayName
   * @returns promise that resolves when firebaseUser is updated
   */
  updateUsername: (username: string) => Promise<void>;
  templateCode: Record<Language, string> | null;
};

const initialUserProviderState: Omit<UserContextType, 'updateUsername'> = {
  firebaseUser: null,
  userData: null,
  userRole: null,
  registered: null,
  logged: null,
  templateCode: null,
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(initialUserProviderState);
  const { firebaseUser, userData } = state;

  useEffect(() => {
    let authVersion = 0;
    let unsubscribeUserData: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(getAuth(), currentUser => {
      const currentAuthVersion = ++authVersion;

      unsubscribeUserData?.();
      unsubscribeUserData = undefined;

      setState({
        ...initialUserProviderState,
        firebaseUser: currentUser,
        logged: currentUser !== null,
      });

      if (!currentUser) return;

      currentUser.getIdTokenResult().then(result => {
        if (currentAuthVersion !== authVersion) return;

        setState(state => ({
          ...state,
          userRole: {
            teacher: result.claims?.teacher,
            admin: result.claims?.admin,
          } as UserRole,
          registered: !!result.claims.registered,
        }));
      });

      // firebaseUser is exposed immediately, but userData is only published
      // once the default display name is set, so that everything gated on
      // userData can rely on firebaseUser.displayName.
      const displayNameReady = currentUser.displayName
        ? Promise.resolve()
        : updateProfile(currentUser, {
            displayName:
              'Anonymous ' +
              animals[Math.floor(animals.length * Math.random())],
          }).catch(error => {
            console.error('Failed to set default display name.', error);
          });

      const userDataRef = ref(getDatabase(), `users/${currentUser.uid}/data`);
      unsubscribeUserData = onValue(userDataRef, (snap: DataSnapshot) => {
        const data = snap.val() ?? {};
        const userData = {
          id: currentUser.uid,
          editorMode: data.editorMode ?? 'Normal',
          tabSize: data.tabSize ?? 4,
          fontSize: data.fontSize ?? DEFAULT_FONT_SIZE_EDITOR,
          lightMode: data.lightMode ?? false,
          rainbowIndent: data.rainbowIndent ?? false,
          defaultPermission: data.defaultPermission ?? 'READ_WRITE',
          defaultLanguage: data.defaultLanguage ?? 'cpp',
          manualSubmission: data.manualSubmission ?? false,
          discordID: data.discordID,
          usernames: data.usernames ?? {},
          templateCode: data.templateCode ?? {},
        };
        void displayNameReady.then(() => {
          if (currentAuthVersion !== authVersion) return;

          setState(state => ({
            ...state,
            userData,
            templateCode: { ...defaultCode, ...data?.templateCode },
          }));
        });
      });
    });

    return () => {
      authVersion++;
      unsubscribeAuth();
      unsubscribeUserData?.();
    };
  }, []);

  const lightMode = userData?.lightMode;

  useEffect(() => {
    if (lightMode === undefined) return;

    const activeTheme = lightMode ? 'light' : 'dark';
    const root = document.documentElement;

    root.dataset.theme = activeTheme;
    root.style.colorScheme = activeTheme;

    if (document.body) {
      document.body.dataset.theme = activeTheme;
      document.body.style.colorScheme = activeTheme;
    }

    try {
      window.localStorage.setItem('algopro-theme', activeTheme);
    } catch {
      // The active theme still works when persistent browser storage is blocked.
    }
  }, [lightMode]);

  const updateUsername = useCallback(
    (newName: string) => {
      if (!firebaseUser)
        throw new Error('Tried to update username but user is null');
      update(ref(getDatabase(), `users/${firebaseUser.uid}/data`), {
        name: newName,
      });

      return updateProfile(firebaseUser, { displayName: newName }).then(() => {
        // we need to trigger a rerender because firebase user never changes
        // but some parts of the app needs to rerender when firebaseUser.displayName changes
        setState(state => ({ ...state, firebaseUser }));
      });
    },
    [firebaseUser]
  );

  return (
    <UserContext.Provider
      value={{
        ...state,
        updateUsername,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useNullableUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
}

export function useUserContext() {
  const { firebaseUser, userData, userRole, updateUsername, templateCode } =
    useNullableUserContext();
  if (!firebaseUser || !userData || !templateCode)
    throw new Error(
      "useUserContext() can only be called after UserProvider has finished loading. If you want to access userContext while it's still loading, use useNullableUserContext() instead"
    );
  return { firebaseUser, userData, userRole, updateUsername, templateCode };
}

export function isTeacher(userRole: UserRole | null): boolean {
  if (userRole === null) return false;
  if (userRole.admin) return true;
  return !!(userRole.teacher && userRole.teacher.length > 0);
}
