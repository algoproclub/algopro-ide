import React from 'react';
import { MessagePage } from './MessagePage';
import { useNullableUserContext } from '../context/UserContext';
import NoRegistrationMessage from '../NoRegistrationMessage';

export default function WithTeacherLogin({
  children,
}: {
  children: JSX.Element;
}): JSX.Element {
  const { userData, logged, registered } = useNullableUserContext();

  if (!logged)
    return (
      <MessagePage
        message="Please log in to access this page."
        showHomeButton={true}
      />
    );

  if (!userData)
    return <MessagePage message="Loading..." showHomeButton={false} />;

  if (!registered)
    return (
      <div className="max-w-3xl mx-auto pt-3 sm:pt-6 px-2 sm:px-4">
        <NoRegistrationMessage />
      </div>
    );

  return <>{children}</>;
}
