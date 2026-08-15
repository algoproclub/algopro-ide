import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseApp from '../../src/firebaseAdmin';
import type { StudentRoster } from '../../src/data/classroomMetadata';

type RequestData = {
  idToken?: string;
  groupID?: string;
  includeSchoolStudents?: boolean;
};

type ResponseData = StudentRoster | { message: string };

const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);

export default async function getSchoolStudents(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!req.body || typeof req.body !== 'object')
    return res.status(400).json({ message: 'Invalid request data' });
  const {
    idToken,
    groupID,
    includeSchoolStudents = false,
  } = req.body as RequestData;
  if (
    typeof idToken !== 'string' ||
    typeof groupID !== 'string' ||
    groupID.length === 0 ||
    groupID.includes('/') ||
    typeof includeSchoolStudents !== 'boolean'
  )
    return res.status(400).json({ message: 'Missing required data' });

  let caller: DecodedIdToken;
  try {
    caller = await auth.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ message: 'Invalid authentication token' });
  }

  if (caller.registered !== true)
    return res.status(403).json({ message: 'Registration required' });

  const group = await firestore.doc(`groups/${groupID}`).get();
  if (!group.exists)
    return res.status(404).json({ message: 'Group not found' });

  const schoolID = group.get('school');
  if (typeof schoolID !== 'string')
    return res.status(500).json({ message: 'Group has no school' });
  const isTeacherAtSchool =
    Array.isArray(caller.teacher) && caller.teacher.includes(schoolID);
  if (caller.admin !== true && !isTeacherAtSchool)
    return res.status(403).json({ message: 'Not authorized for this group' });

  const users = await firestore
    .collection('userdata')
    .where(
      includeSchoolStudents ? 'schools' : 'groups',
      'array-contains',
      includeSchoolStudents ? schoolID : groupID
    )
    .get();
  const records = users.docs.flatMap(user => {
    const schools = user.get('schools');
    if (!Array.isArray(schools) || !schools.includes(schoolID)) return [];
    const groups = user.get('groups');
    return [
      {
        id: user.id,
        name:
          typeof user.get('user_full_name') === 'string'
            ? user.get('user_full_name')
            : '(name not set)',
        isInGroup: Array.isArray(groups) && groups.includes(groupID),
      },
    ];
  });
  const memberUIDs = records
    .filter(user => user.isInGroup)
    .map(user => user.id);

  if (!includeSchoolStudents) {
    return res.status(200).json({
      schoolID,
      memberUIDs,
      students: records
        .map(({ id, name }) => ({ id, name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    });
  }

  const authRequests = records.map(user => ({ uid: user.id }));
  const authUsers = await Promise.all(
    Array.from({ length: Math.ceil(authRequests.length / 100) }, (_, index) =>
      auth.getUsers(authRequests.slice(index * 100, (index + 1) * 100))
    )
  );
  const emailByUID = new Map(
    authUsers
      .flatMap(result => result.users)
      .map(user => [user.uid, user.email ?? null])
  );
  return res.status(200).json({
    schoolID,
    memberUIDs,
    students: records
      .map(user => ({
        id: user.id,
        name: user.name,
        email: emailByUID.get(user.id) ?? null,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  });
}
