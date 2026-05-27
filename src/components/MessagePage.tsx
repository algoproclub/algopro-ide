import React from 'react';
import Link from 'next/link';

export const MessagePage = ({
  message,
  showHomeButton = true,
}: {
  message: string;
  showHomeButton?: boolean;
}): JSX.Element => {
  return (
    <div className="p-8 sm:p-16 text-center theme-page">
      <div className="text-3xl sm:text-4xl theme-text font-bold">
        {message}
      </div>
      {showHomeButton && (
        <Link
          href="/"
          // szda re-theme phase2: message page actions use shared primary button tokens.
          className="mt-6 sm:mt-10 inline-flex items-center px-4 py-2 border text-base font-medium rounded-md shadow-sm theme-button-primary focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--app-bg)]"
        >
          Go Home
        </Link>
      )}
    </div>
  );
};
