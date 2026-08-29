import React from 'react';
import { MessagePage } from './MessagePage';
import { useNullableUserContext, isTeacher } from '../context/UserContext';

export default function WithTeacherLogin({
  children,
}: {
  children: JSX.Element;
}): JSX.Element {
  const { userData, logged, userRole } = useNullableUserContext();

  if (!logged)
    return (
      <MessagePage
        message="Please log in to access this page."
        showHomeButton={true}
      />
    );

  if (!userData)
    return <MessagePage message="Loading…" showHomeButton={false} />;

  if (!isTeacher(userRole)) {
    return (
      <MessagePage
        message="You must be a teacher to view this page."
        showHomeButton={true}
      />
    );
  }

  return <>{children}</>;
}
