import React from 'react';
import { MessagePage } from './MessagePage';
import { useNullableUserContext } from '../context/UserContext';
import NoRegistrationMessage from '../NoRegistrationMessage';
import { SHOULD_USE_FIREBASE_EMULATOR } from '../dev_constants';

export default function WithRegistration({
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

  // In the emulator (local dev) UserContext auto-grants the `registered` claim
  // right after sign-in; WAIT for it rather than rendering the gated children
  // with a non-registered token — the RTDB rules require auth.token.registered,
  // so a premature file read shows "this file is private". Production (real
  // Firebase) shows the real registration gate.
  if (!registered)
    return SHOULD_USE_FIREBASE_EMULATOR ? (
      <MessagePage
        message="Preparing your dev session…"
        showHomeButton={false}
      />
    ) : (
      <div className="max-w-3xl mx-auto pt-3 sm:pt-6 px-2 sm:px-4">
        <NoRegistrationMessage />
      </div>
    );

  return <>{children}</>;
}
