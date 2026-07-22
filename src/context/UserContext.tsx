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
  off,
  update,
} from 'firebase/database';

import animals from '../scripts/animals';
import { Platform } from '../types/problem';
import defaultCode from '../scripts/defaultCode';

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
    label: 'Python 3.8.1',
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

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [logged, setLogged] = useState<boolean | null>(null);
  const [, triggerRerender] = useState<number>(0);
  const [templateCode, setTemplateCode] = useState<Record<
    Language,
    string
  > | null>(null);

  const updateClaims = useCallback(() => {
    user?.getIdTokenResult().then(res => {
      setUserRole({
        teacher: res.claims?.teacher,
        admin: res.claims?.admin,
      } as UserRole);
      setRegistered(!!res.claims.registered);
    });
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), user => {
      if (!user) {
        setLogged(false);
        setUserData(null);
        setUserRole(null);
        setTemplateCode(null);
        setRegistered(null);
      } else {
        setLogged(true);
        updateClaims();
        let displayName = user.displayName;
        if (!displayName) {
          displayName =
            'Anonymous ' + animals[Math.floor(animals.length * Math.random())];
          updateProfile(user, { displayName }).then(() => setUser(user));
        } else {
          setUser(user);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [updateClaims]);

  useEffect(() => {
    if (!user) return;

    const handleSnapshot = (snap: DataSnapshot) => {
      const data = snap.val() ?? {};
      setUserData({
        id: user.uid,
        editorMode: data.editorMode ?? 'Normal',
        tabSize: data.tabSize ?? 4,
        fontSize: data.fontSize ?? 13,
        lightMode: data.lightMode ?? false,
        rainbowIndent: data.rainbowIndent ?? false,
        defaultPermission: data.defaultPermission ?? 'READ_WRITE',
        defaultLanguage: data.defaultLanguage ?? 'cpp',
        manualSubmission: data.manualSubmission ?? false,
        discordID: data.discordID,
        usernames: data.usernames ?? {},
        templateCode: data.templateCode ?? {},
      });
      setTemplateCode({ ...defaultCode, ...data?.templateCode });
    };
    onValue(ref(getDatabase(), `users/${user.uid}/data`), handleSnapshot);
    return () =>
      off(
        ref(getDatabase(), `users/${user.uid}/data`),
        'value',
        handleSnapshot
      );
  }, [user]);

  useEffect(() => {
    const activeTheme = userData?.lightMode ? 'light' : 'dark';
    const root = document.documentElement;

    root.dataset.theme = activeTheme;
    root.style.colorScheme = activeTheme;

    if (document.body) {
      document.body.dataset.theme = activeTheme;
      document.body.style.colorScheme = activeTheme;
    }
  }, [userData?.lightMode]);

  const updateUsername = useCallback(
    (newName: string) => {
      if (!user) throw new Error('Tried to update username but user is null');
      update(ref(getDatabase(), `users/${user.uid}/data`), { name: newName });

      return updateProfile(user, { displayName: newName }).then(() => {
        // we need to trigger a rerender because firebase user never changes
        // but some parts of the app needs to rerender when firebaseUser.displayName changes
        triggerRerender(Date.now());
      });
    },
    [user]
  );

  return (
    <UserContext.Provider
      value={{
        firebaseUser: user,
        userData,
        userRole,
        registered,
        updateUsername,
        logged,
        templateCode,
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
