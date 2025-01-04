import { EditorMode, Language } from '../context/UserContext';
import { getDatabase, ref, runTransaction } from 'firebase/database';

export const updateUserSettings = async ({
  userID,
  cfUsername,
  atcoderUsername,
  discordID,
  editorMode,
  tabSize,
  lightMode,
  manualSubmission,
  defaultLanguage,
  templateCode,
}: {
  userID: string;
  cfUsername: string;
  atcoderUsername: string;
  discordID: string;
  editorMode: EditorMode;
  tabSize: number;
  lightMode: boolean;
  manualSubmission: boolean;
  defaultLanguage: Language;
  templateCode: Partial<Record<Language, string>>;
}) => {
  await runTransaction(ref(getDatabase(), `users/${userID}/data`), data => {
    const newData = {
      editorMode,
      tabSize,
      lightMode,
      manualSubmission,
      defaultLanguage,
      discordID,
    };
    data = data ? { ...data, ...newData } : newData;
    if (!data.usernames) {
      data.usernames = {};
    }
    data.usernames.codeforces = cfUsername;
    data.usernames.atcoder = atcoderUsername;
    data.templateCode = templateCode;
    return data;
  });
};
