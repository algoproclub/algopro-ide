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
import { signInAnonymously } from '../scripts/firebaseUtils';
import animals from '../scripts/animals';

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
export type UserData = {
  id?: string;
  editorMode: EditorMode;
  tabSize: number;
  lightMode: boolean;
  defaultPermission: 'READ_WRITE' | 'READ' | 'PRIVATE';
  defaultLanguage: Language;
};

export type UserContextType = {
  firebaseUser: User | null;
  userData: UserData | null;
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
  const [logged, setLogged] = useState<boolean | null>(null);
  const [_, triggerRerender] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), user => {
      if (!user) {
        setLogged(false);
        setUserData(null);
      } else {
        setLogged(true);
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
      const data = snap.val() ?? {};
      setUserData({
        id: user.uid,
        editorMode: data.editorMode ?? 'Normal',
        tabSize: data.tabSize ?? 4,
        lightMode: data.lightMode ?? false,
        defaultPermission: data.defaultPermission ?? 'READ_WRITE',
        defaultLanguage: data.defaultLanguage ?? 'cpp',
      });
    };
    onValue(ref(getDatabase(), `users/${user.uid}/data`), handleSnapshot);
    return () =>
      off(
        ref(getDatabase(), `users/${user.uid}/data`),
        'value',
        handleSnapshot
      );
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
      value={{ firebaseUser: user, userData, updateUsername, logged }}
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
  const { firebaseUser, userData, updateUsername } = useNullableUserContext();
  if (!firebaseUser || !userData)
    throw new Error(
      "useUserContext() can only be called after UserProvider has finished loading. If you want to access userContext while it's still loading, use useNullableUserContext() instead"
    );
  return { firebaseUser, userData, updateUsername };
}
