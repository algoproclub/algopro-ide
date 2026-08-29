import React from 'react';
import { MessagePage } from './MessagePage';
import { useNullableUserContext } from '../context/UserContext';

export default function WithAdminLogin({
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

  if (userRole?.admin !== true) {
    return (
      <MessagePage
        message="You must be an admin to view this page."
        showHomeButton={true}
      />
    );
  }

  return <>{children}</>;
}
