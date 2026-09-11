import {
  DEFAULT_FONT_SIZE_EDITOR,
  MAX_FONT_SIZE_EDITOR,
  MIN_FONT_SIZE_EDITOR,
} from '../constants/editorConstants';
import { EditorMode, Language } from '../context/UserContext';
import { getDatabase, ref, runTransaction } from 'firebase/database';

export const updateUserSettings = async ({
  userID,
  cfUsername,
  atcoderUsername,
  discordID,
  editorMode,
  tabSize,
  fontSize,
  lightMode,
  rainbowIndent,
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
  fontSize: number;
  lightMode: boolean;
  rainbowIndent: boolean;
  manualSubmission: boolean;
  defaultLanguage: Language;
  templateCode: Partial<Record<Language, string>>;
}) => {
  await runTransaction(ref(getDatabase(), `users/${userID}/data`), data => {
    const newData = {
      editorMode,
      tabSize,
      fontSize: Math.min(
        MAX_FONT_SIZE_EDITOR,
        Math.max(
          MIN_FONT_SIZE_EDITOR,
          Number.isNaN(fontSize) ? DEFAULT_FONT_SIZE_EDITOR : fontSize
        )
      ),
      lightMode,
      rainbowIndent,
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
