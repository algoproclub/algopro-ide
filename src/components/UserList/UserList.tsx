import { isUserOnline, useOnlineUsers, User } from '../../hooks/useOnlineUsers';
import React, { useMemo } from 'react';
import { UserListItem } from './UserListItem';
import classNames from 'classnames';

export const UserList = ({
  className,
}: {
  className?: string;
}): JSX.Element => {
  const users = useOnlineUsers();

  const sortedUsers: User[] | null = useMemo(() => {
    if (!users) return null;
    return (
      [...users]
        // some people may have connected without having a name yet
        .filter(user => user.name)
        .sort((a, b) => {
          if (isUserOnline(a) !== isUserOnline(b)) {
            return isUserOnline(a) ? -1 : 1;
          }
          if (a.permission !== b.permission) {
            if (a.permission === 'OWNER') return -1;
            if (b.permission === 'OWNER') return 1;
            if (a.permission === 'READ_WRITE') return -1;
            if (b.permission === 'READ_WRITE') return 1;
            return -1;
          }
          return a.name.localeCompare(b.name);
        })
    );
  }, [users]);

  return (
    <div className={classNames('flex flex-col mx-4', className)}>
      <div className="font-bold py-2.5 px-4 border border-gray-700 rounded-t-md text-sm bg-gray-800">
        Users
      </div>
      <ul className="px-4 py-2 flex-1 overflow-y-auto min-h-0 bg-[#161616] border border-t-0 border-gray-700 max-h-[12rem]">
        {(sortedUsers || []).map(user => (
          <UserListItem user={user} key={user.id} />
        ))}
      </ul>
    </div>
  );
};
