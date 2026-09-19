import React from 'react';
import { MessagePage } from './MessagePage';
import { useNullableUserContext } from '../context/UserContext';
import NoRegistrationMessage from '../NoRegistrationMessage';

export default function WithRegistration({
  children,
  waitForUserData = false,
}: {
  children: JSX.Element;
  waitForUserData?: boolean;
}): JSX.Element {
  const { userData, logged, registered } = useNullableUserContext();

  if (logged === false)
    return (
      <MessagePage
        message="Please log in to access this page."
        showHomeButton={true}
      />
    );

  if (logged === null || registered === null || (waitForUserData && !userData))
    return <MessagePage message="Loading…" showHomeButton={false} />;

  if (!registered)
    return (
      <div className="max-w-3xl mx-auto pt-3 sm:pt-6 px-2 sm:px-4">
        <NoRegistrationMessage />
      </div>
    );

  return <>{children}</>;
}
