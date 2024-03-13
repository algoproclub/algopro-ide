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
} from 'firebase/database';

import animals from '../scripts/animals';
import { Platform } from '../types/problem';

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

export type UserData = {
  id: string;
  editorMode: EditorMode;
  tabSize: number;
  lightMode: boolean;
  defaultPermission: 'READ_WRITE' | 'READ' | 'PRIVATE';
  defaultLanguage: Language;
  manualSubmission: boolean;
  discordID: string;
  usernames: UsernameData;
};

type UserRole = 'student' | 'teacher';

export type UserContextType = {
  firebaseUser: User | null;
  userData: UserData | null;
  userRole: UserRole | null;
  logged: boolean | null;
  /**
   * Updates firebaseUser.displayName. Normally doing this doesn't trigger rerender
   * so use this function, which will force a UI rerender
   * @param username The new value of firebaseUser.displayName
   * @returns promise that resolves when firebaseUser is updated
   */
  updateUsername: (username: string) => Promise<any>;
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [logged, setLogged] = useState<boolean | null>(null);
  const [_, triggerRerender] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), user => {
      if (!user) {
        setLogged(false);
        setUserData(null);
        setUserRole(null);
      } else {
        setLogged(true);
        user
          .getIdTokenResult()
          .then(res => setUserRole(res.claims.teacher ? 'teacher' : 'student'));
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
  }, []);

  useEffect(() => {
    if (!user) return;

    const handleSnapshot = (snap: DataSnapshot) => {
      const data = snap.val()?.data ?? {};
      setUserData({
        id: user.uid,
        editorMode: data.editorMode ?? 'Normal',
        tabSize: data.tabSize ?? 4,
        lightMode: data.lightMode ?? false,
        defaultPermission: data.defaultPermission ?? 'READ_WRITE',
        defaultLanguage: data.defaultLanguage ?? 'cpp',
        manualSubmission: data.manualSubmission ?? false,
        discordID: data.discordID,
        usernames: data.usernames ?? {},
      });
    };
    onValue(ref(getDatabase(), `users/${user.uid}`), handleSnapshot);
    return () =>
      off(ref(getDatabase(), `users/${user.uid}`), 'value', handleSnapshot);
  }, [user]);

  const updateUsername = useCallback(
    (newName: string) => {
      if (!user) throw new Error('Tried to update username but user is null');
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
      value={{ firebaseUser: user, userData, userRole, updateUsername, logged }}
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
  const { firebaseUser, userData, userRole, updateUsername } =
    useNullableUserContext();
  if (!firebaseUser || !userData)
    throw new Error(
      "useUserContext() can only be called after UserProvider has finished loading. If you want to access userContext while it's still loading, use useNullableUserContext() instead"
    );
  return { firebaseUser, userData, userRole, updateUsername };
}
