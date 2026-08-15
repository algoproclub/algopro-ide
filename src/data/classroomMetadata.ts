import {
  collection,
  doc,
  documentId,
  type FieldPath,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  QueryDocumentSnapshot,
  where,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { UserRole } from '../context/UserContext';
import { getPlatformName } from '../scripts/getPlatformName';
import { parseProblem } from '../scripts/parseProblem';
import { Platform, URLProblem } from '../types/problem';

const firestore = getFirestore();
const FIRESTORE_IN_QUERY_LIMIT = 30;

export type School = { id: string; name: string };

export type GroupInfo = {
  id: string;
  name: string;
  schoolID: string;
  schoolName?: string;
  inactive?: boolean;
};

export type Student = {
  id: string;
  name: string;
  email?: string | null;
};

export type StudentRoster = {
  schoolID: string;
  memberUIDs: string[];
  students: Student[];
};

export type GroupClassData = {
  tasks: URLProblem[];
  creationTime: number;
};

export type GroupClass = { id: string; data: GroupClassData };

export type ClassTask = {
  platform: Platform;
  id: string;
  url: string;
  source: string;
  title?: string;
};

export type TaskStatusTarget = {
  key: string;
  platform: Platform;
  id: string;
};

export type DashboardTask = ClassTask & { key: string };

const fetchStudentRoster = async (
  groupID: string,
  scope: 'group' | 'school'
): Promise<StudentRoster> => {
  const currentUser = getAuth().currentUser;
  if (!currentUser) throw new Error('You must be signed in to load students.');
  const response = await fetch('/api/getSchoolStudents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idToken: await currentUser.getIdToken(),
      groupID,
      includeSchoolStudents: scope === 'school',
    }),
  });
  if (!response.ok) throw new Error('Could not load students.');
  return response.json();
};

export const fetchGroupStudents = async (groupID: string): Promise<Student[]> =>
  (await fetchStudentRoster(groupID, 'group')).students;

export const fetchSchoolStudents = (groupID: string) =>
  fetchStudentRoster(groupID, 'school');

const fetchDocumentsWhereIn = async (
  collectionName: string,
  field: string | FieldPath,
  values: string[]
) => {
  const uniqueValues = Array.from(new Set(values));
  const snapshots = await Promise.all(
    Array.from(
      { length: Math.ceil(uniqueValues.length / FIRESTORE_IN_QUERY_LIMIT) },
      (_, index) => {
        const valueChunk = uniqueValues.slice(
          index * FIRESTORE_IN_QUERY_LIMIT,
          (index + 1) * FIRESTORE_IN_QUERY_LIMIT
        );
        return getDocs(
          query(
            collection(firestore, collectionName),
            where(field, 'in', valueChunk)
          )
        );
      }
    )
  );

  return snapshots.flatMap(snapshot => snapshot.docs);
};

export const fetchManagedSchools = async (
  userRole: UserRole | null
): Promise<School[]> => {
  let schools: School[];
  if (userRole?.admin) {
    schools = (await getDocs(collection(firestore, 'schools'))).docs.map(
      school => ({
        id: school.id,
        name: school.data().name || school.id,
      })
    );
  } else {
    const schoolIDs = Array.from(new Set(userRole?.teacher ?? []));
    if (schoolIDs.length === 0) return [];
    const schoolDocuments = await fetchDocumentsWhereIn(
      'schools',
      documentId(),
      schoolIDs
    );
    const schoolByID = new Map(
      schoolDocuments.map(school => [school.id, school])
    );
    schools = schoolIDs.map(id => ({
      id,
      name: schoolByID.get(id)?.data()?.name || id,
    }));
  }

  return schools.sort((left, right) => left.name.localeCompare(right.name));
};

export const fetchSchoolGroups = async (
  schoolID: string,
  { includeInactive = false }: { includeInactive?: boolean } = {}
): Promise<GroupInfo[]> => {
  if (!schoolID) return [];
  const results = await getDocs(
    query(collection(firestore, 'groups'), where('school', '==', schoolID))
  );
  const groups: GroupInfo[] = [];
  results.forEach(groupDoc => {
    const data = groupDoc.data();
    const inactive = data?.inactive === true;
    if (inactive && !includeInactive) return;
    groups.push({
      id: groupDoc.id,
      name: data?.name || groupDoc.id,
      schoolID,
      inactive,
    });
  });
  groups.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
};

export const fetchAccessibleGroups = async (
  userID: string,
  userRole: UserRole | null
): Promise<GroupInfo[]> => {
  const teacherSchools = userRole?.teacher ?? [];
  let groupDocs: QueryDocumentSnapshot[];

  if (userRole?.admin === true) {
    groupDocs = (await getDocs(collection(firestore, 'groups'))).docs;
  } else if (teacherSchools.length > 0) {
    groupDocs = await fetchDocumentsWhereIn('groups', 'school', teacherSchools);
  } else {
    const groupIDs: string[] =
      (await getDoc(doc(firestore, 'userdata', userID))).data()?.groups ?? [];
    if (groupIDs.length === 0) return [];

    const fetchedGroupDocs = await fetchDocumentsWhereIn(
      'groups',
      documentId(),
      groupIDs
    );
    const groupDocsByID = new Map(
      fetchedGroupDocs.map(groupDoc => [groupDoc.id, groupDoc])
    );
    groupDocs = groupIDs.flatMap(id => {
      const groupDoc = groupDocsByID.get(id);
      return groupDoc ? [groupDoc] : [];
    });
  }

  const schoolIDs = Array.from(
    new Set<string>(
      groupDocs.map(groupDoc => groupDoc.data()?.school).filter(Boolean)
    )
  );
  const schoolNameByID: Record<string, string> = {};
  if (schoolIDs.length > 1) {
    const schoolDocs = await fetchDocumentsWhereIn(
      'schools',
      documentId(),
      schoolIDs
    );
    schoolDocs.forEach(schoolDoc => {
      schoolNameByID[schoolDoc.id] = schoolDoc.data()?.name || schoolDoc.id;
    });
  }

  return groupDocs
    .map(groupDoc => {
      const group = groupDoc.data();
      const schoolID = group?.school ?? '';
      return {
        id: groupDoc.id,
        name: group?.name || groupDoc.id,
        schoolID,
        schoolName: schoolNameByID[schoolID],
        inactive: group?.inactive === true,
      };
    })
    .sort(
      (left, right) =>
        (left.schoolName ?? '').localeCompare(right.schoolName ?? '') ||
        left.name.localeCompare(right.name)
    );
};

export const fetchGroupClasses = async (
  groupID: string
): Promise<GroupClass[]> => {
  const classes = await getDocs(
    query(
      collection(firestore, 'groups', groupID, 'classes'),
      orderBy('creationTime', 'desc')
    )
  );
  return classes.docs.map(classDocument => ({
    id: classDocument.id,
    data: classDocument.data() as GroupClassData,
  }));
};

export const getDashboardTasks = (problems: URLProblem[]): DashboardTask[] =>
  problems.flatMap(({ url, title }, index) => {
    const parsed = parseProblem(url);
    if (!parsed.id || !parsed.platform) return [];
    const task: ClassTask = {
      id: parsed.id,
      platform: parsed.platform,
      source: `${getPlatformName(parsed.platform)} - ${parsed.id}`,
      url,
      title: title ?? undefined,
    };
    return [
      {
        ...task,
        key: `${task.platform}:${task.id}:${index}`,
      },
    ];
  });
