import {
  doc,
  documentId,
  getDoc,
  getFirestore,
  Timestamp,
} from 'firebase/firestore';
import {
  endBefore,
  get,
  getDatabase,
  limitToLast,
  orderByChild,
  query,
  ref,
} from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { LANGUAGES } from '../context/UserContext';
import { getPlatformName } from '../scripts/getPlatformName';
import { buildProblemUrl } from '../scripts/problemUtils';
import { platforms, type Platform } from '../types/problem';
import { fetchDocumentsWhereIn, type School } from './classroomMetadata';
import { fetchTaskStatusForFile, type TaskStatus } from './taskStatus';

const firestore = getFirestore();
const database = getDatabase();

export type ProfileField = { key: string; label: string; value: string };

export type ProfileGroup = {
  id: string;
  name: string;
  schoolID: string;
  schoolName: string;
};

export type StudentProfile = {
  id: string;
  name: string;
  schools: School[];
  fields: ProfileField[];
  groups: ProfileGroup[];
};

export type StudentAccount = { email: string | null };

export class ProfileAccessError extends Error {}

// Discord-owned fields live in Firestore, editor settings in the Realtime
// Database. Platform handles are currently duplicated across both; the
// Firestore copy wins so that a Discord-side correction is what teachers see.
const firestoreFields = [
  ['first_seen', 'First seen'],
  ['atcoder_handle', 'AtCoder handle'],
  ['codeforces_handle', 'Codeforces handle'],
  ['user_discord_id', 'Discord ID'],
  ['user_discord_name', 'Discord name'],
  ['user_full_name', 'Full name'],
] as const;

const handleFallbacks: Partial<Record<string, Platform>> = {
  atcoder_handle: 'atcoder',
  codeforces_handle: 'codeforces',
};

export const formatLanguage = (language: unknown) =>
  LANGUAGES.find(option => option.value === language)?.label ?? null;

const formatFieldValue = (value: unknown): string | null => {
  if (value instanceof Timestamp) return value.toDate().toLocaleString('en');
  if (typeof value === 'number') return new Date(value).toLocaleString('en');
  if (typeof value === 'string') return value.trim() || null;
  return null;
};

const fetchStudentAccount = async (userID: string): Promise<StudentAccount> => {
  const currentUser = getAuth().currentUser;
  if (!currentUser) throw new Error('You must be signed in.');
  const response = await fetch('/api/getStudentAccount', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await currentUser.getIdToken()}`,
    },
    body: JSON.stringify({ userID }),
  });
  if (!response.ok) throw new Error('Could not load the account.');
  return response.json();
};

// The sign-in address identifies the account, so it leads. A Discord-provided
// address is only worth showing separately when it differs from it.
const getEmailFields = (
  accountEmail: string | null,
  studentEmail: string | null
): ProfileField[] => {
  if (!accountEmail)
    return studentEmail
      ? [{ key: 'student_email', label: 'Email', value: studentEmail }]
      : [];
  const fields = [{ key: 'email', label: 'Email', value: accountEmail }];
  if (studentEmail && studentEmail.toLowerCase() !== accountEmail.toLowerCase())
    fields.push({
      key: 'student_email',
      label: 'Secondary email',
      value: studentEmail,
    });
  return fields;
};

const fetchSchools = async (schoolIDs: string[]): Promise<School[]> => {
  if (schoolIDs.length === 0) return [];
  const schoolDocs = await fetchDocumentsWhereIn(
    'schools',
    documentId(),
    schoolIDs
  );
  const schoolByID = new Map(
    schoolDocs.map(schoolDoc => [schoolDoc.id, schoolDoc])
  );
  return schoolIDs.map(id => ({
    id,
    name: (schoolByID.get(id)?.data()?.name as string | undefined) || id,
  }));
};

const fetchGroups = async (
  groupIDs: string[],
  schoolNameByID: Map<string, string>
): Promise<ProfileGroup[]> => {
  if (groupIDs.length === 0) return [];
  const groupDocs = await fetchDocumentsWhereIn(
    'groups',
    documentId(),
    groupIDs
  );
  return groupDocs
    .map(groupDoc => {
      const schoolID = (groupDoc.data()?.school as string | undefined) ?? '';
      return {
        id: groupDoc.id,
        name: (groupDoc.data()?.name as string | undefined) || groupDoc.id,
        schoolID,
        schoolName: schoolNameByID.get(schoolID) ?? schoolID,
      };
    })
    .sort(
      (left, right) =>
        left.schoolName.localeCompare(right.schoolName) ||
        left.name.localeCompare(right.name)
    );
};

export const fetchStudentProfile = async (
  userID: string
): Promise<StudentProfile> => {
  const userdata = await getDoc(doc(firestore, 'userdata', userID)).catch(
    error => {
      if ((error as { code?: string }).code === 'permission-denied')
        throw new ProfileAccessError('You cannot view this student.');
      throw error;
    }
  );
  if (!userdata.exists()) throw new ProfileAccessError('No such student.');
  const data = userdata.data();
  const schoolIDs: string[] = Array.isArray(data.schools) ? data.schools : [];
  const groupIDs: string[] = Array.isArray(data.groups) ? data.groups : [];

  const [settings, account] = await Promise.all([
    get(ref(database, `users/${userID}/data`)).then(
      snapshot => snapshot.val() ?? {},
      // The profile is still worth showing when the user never opened the editor.
      () => ({})
    ),
    fetchStudentAccount(userID).catch((): StudentAccount => ({ email: null })),
  ]);
  const schools = await fetchSchools(schoolIDs);
  const groups = await fetchGroups(
    groupIDs,
    new Map(schools.map(school => [school.id, school.name]))
  );

  const fields: ProfileField[] = getEmailFields(
    account.email,
    formatFieldValue(data.student_email)
  );
  fields.push(
    ...firestoreFields.flatMap(([key, label]) => {
      const fallbackPlatform = handleFallbacks[key];
      const value =
        formatFieldValue(data[key]) ??
        (fallbackPlatform
          ? formatFieldValue(settings.usernames?.[fallbackPlatform])
          : null);
      return value === null ? [] : [{ key, label, value }];
    })
  );
  const defaultLanguage = formatLanguage(settings.defaultLanguage);
  if (defaultLanguage)
    fields.push({
      key: 'defaultLanguage',
      label: 'Default language',
      value: defaultLanguage,
    });

  return {
    id: userID,
    name:
      formatFieldValue(data.user_full_name) ??
      formatFieldValue(settings.name) ??
      '(name not set)',
    schools,
    fields,
    groups,
  };
};

export type PlatformProgress = {
  platform: Platform;
  name: string;
  openedProblems: Array<{ id: string; fileID: string }>;
  solvedIDs: Set<string>;
};

export const fetchPlatformProgress = (
  userID: string
): Promise<PlatformProgress[]> =>
  Promise.all(
    platforms.map(async platform => {
      const snapshot = await get(
        ref(database, `users/${userID}/platform-${platform}`)
      );
      const progress = snapshot.val() ?? {};
      const mapping: Record<string, unknown> =
        progress['problem-id-to-file-id'] ?? {};
      return {
        platform,
        name: getPlatformName(platform),
        openedProblems: Object.entries(mapping)
          .flatMap(([id, fileID]) =>
            typeof fileID === 'string' && fileID ? [{ id, fileID }] : []
          )
          .sort((left, right) =>
            left.id.localeCompare(right.id, undefined, { numeric: true })
          ),
        solvedIDs: new Set(Object.keys(progress.solved ?? {})),
      };
    })
  );

export type UserFileRow = {
  id: string;
  title: string;
  hidden: boolean;
  lastAccessTime: number | null;
  creationTime: number | null;
  language: string | null;
  problem: { label: string; url: string | null } | null;
  status: TaskStatus | null;
};

export type UserFilesCursor = { lastAccessTime: number; key: string };

export type UserFilesPage = {
  files: UserFileRow[];
  nextCursor: UserFilesCursor | null;
};

// The index under users/<id>/files also records files the student only opened,
// so pages are filled from consecutive query batches until enough owned files
// are collected. The cap bounds the reads a single page request can trigger.
const MAX_BATCHES_PER_PAGE = 5;

const asTimestamp = (value: unknown): number | null => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || null;
  return null;
};

const describeProblem = (problem: unknown): UserFileRow['problem'] => {
  if (!problem || typeof problem !== 'object') return null;
  const { platform, id, title, url, source } = problem as Record<
    string,
    unknown
  >;
  if (typeof platform !== 'string' || typeof id !== 'string') return null;
  const problemPlatform = platform as Platform;
  return {
    label:
      (typeof title === 'string' && title) ||
      (typeof source === 'string' && source) ||
      `${getPlatformName(problemPlatform)} - ${id}`,
    url:
      (typeof url === 'string' && url) || buildProblemUrl(problemPlatform, id),
  };
};

const loadFileDetails = async (
  fileID: string,
  entry: Record<string, unknown>
): Promise<UserFileRow> => {
  const [language, problem, status] = await Promise.all([
    get(ref(database, `files/${fileID}/settings/language`)).then(snapshot =>
      snapshot.val()
    ),
    get(ref(database, `files/${fileID}/problem`)).then(snapshot =>
      snapshot.val()
    ),
    fetchTaskStatusForFile(fileID),
  ]);
  return {
    id: fileID,
    title:
      (typeof entry.title === 'string' && entry.title.trim()) ||
      '(Unnamed workspace)',
    hidden: entry.hidden === true,
    lastAccessTime: asTimestamp(entry.lastAccessTime),
    creationTime: asTimestamp(entry.creationTime),
    language: formatLanguage(language),
    problem: describeProblem(problem),
    status,
  };
};

export const fetchOwnedFilesPage = async (
  userID: string,
  cursor: UserFilesCursor | null,
  pageSize: number
): Promise<UserFilesPage> => {
  const filesRef = ref(database, `users/${userID}/files`);
  const owned: Array<{ fileID: string; entry: Record<string, unknown> }> = [];
  let position = cursor;
  let exhausted = false;

  for (
    let batch = 0;
    batch < MAX_BATCHES_PER_PAGE && owned.length < pageSize && !exhausted;
    batch++
  ) {
    const snapshot = await get(
      position
        ? query(
            filesRef,
            orderByChild('lastAccessTime'),
            endBefore(position.lastAccessTime, position.key),
            limitToLast(pageSize)
          )
        : query(filesRef, orderByChild('lastAccessTime'), limitToLast(pageSize))
    );
    const entries: Array<{ fileID: string; entry: Record<string, unknown> }> =
      [];
    snapshot.forEach(child => {
      if (child.key) entries.push({ fileID: child.key, entry: child.val() });
    });
    const isLastBatch = entries.length < pageSize;
    entries.reverse();

    let consumed = 0;
    for (const { fileID, entry } of entries) {
      consumed++;
      position = {
        lastAccessTime: asTimestamp(entry.lastAccessTime) ?? 0,
        key: fileID,
      };
      const owner = entry.owner as { id?: string } | undefined;
      const isOwned = owner
        ? owner.id === userID
        : entry.lastPermission === 'OWNER';
      if (isOwned) owned.push({ fileID, entry });
      if (owned.length === pageSize) break;
    }
    if (isLastBatch && consumed === entries.length) exhausted = true;
  }

  return {
    files: await Promise.all(
      owned.map(({ fileID, entry }) => loadFileDetails(fileID, entry))
    ),
    nextCursor: exhausted ? null : position,
  };
};
