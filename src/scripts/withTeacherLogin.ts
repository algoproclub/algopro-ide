import React from 'react';
import { MessagePage } from './MessagePage';
import { useNullableUserContext } from '../context/UserContext';

export default function withTeacherLogin(
  inner: () => JSX.Element
): () => JSX.Element {
  return () => {
    const { userData, logged, userRole } = useNullableUserContext();

    if (!userData)
      return <MessagePage message="Loading..." showHomeButton={false} />;

    if (!logged)
      return (
        <MessagePage
          message="Please log in to access this page."
          showHomeButton={true}
        />
      );

    if (userRole !== 'teacher')
      return (
        <MessagePage
          message="You must be a teacher to view this page."
          showHomeButton={true}
        />
      );

    return inner();
  };
}
