import { update, ref, getDatabase, push } from 'firebase/database';
import { useAtomValue } from 'jotai/utils';
import { useEffect } from 'react';
import { useConnectionContext } from '../context/ConnectionContext';
import { useEditorContext } from '../context/EditorContext';
import { useUserContext } from '../context/UserContext';
import colorFromUserId from '../scripts/colorFromUserId';

/**
 * Adds user connection to the active file, as well as the
 * active file's associated classroom if it exists.
 *
 * Also, updates the user data for the file.
 */
export default function useUserFileConnection() {
  const connectionContext = useConnectionContext();
  const { userData, firebaseUser } = useUserContext();
  const { fileData } = useEditorContext();

  useEffect(() => {
    update(ref(getDatabase(), `files/${fileData.id}/users/${userData.id}`), {
      name: firebaseUser.displayName,
      color: colorFromUserId(userData.id),
    });

    const connectionsRef = push(
      ref(
        getDatabase(),
        `files/${fileData.id}/users/${userData.id}/connections`
      )
    );
    connectionContext.addConnectionRef(connectionsRef);
    return () => connectionContext.removeConnectionRef(connectionsRef);
  }, [fileData.id, firebaseUser.displayName]);

  // const classroomConnectionsRef = useMemo(
  //   () =>
  //     firebaseUser &&
  //     settings.settings.classroomID &&
  //     firebase
  //       .database()
  //       .ref(
  //         `/classrooms/-${settings.settings.classroomID}/students/${firebaseUser.uid}/connections`
  //       ),
  //   [firebaseUser?.uid, settings.settings.classroomID]
  // );

  // useEffect(() => {
  //   if (!classroomConnectionsRef) return;

  //   const ref = classroomConnectionsRef.push();
  //   connectionContext.addConnectionRef(ref);
  //   return () => connectionContext.removeConnectionRef(ref);
  // }, [classroomConnectionsRef]);
}
