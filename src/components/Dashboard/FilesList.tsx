import React from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
import { permissionLabels } from '../UserList/UserListItem';
import invariant from 'tiny-invariant';
import { useUserContext } from '../../context/UserContext';
import { update, ref, getDatabase } from 'firebase/database';

export type File = {
  id: string;
  lastAccessTime: number;
  title: string;
  creationTime: number | null;
  lastPermission: string | null;
  lastDefaultPermission: string | null;
  hidden: boolean | null;
  version: number;
  language: string;
  owner?: {
    name: string;
    id: string;
  }; // added in v2
};

export interface FilesListProps {
  files: File[];
  showPerms: boolean;
}

export const sharingPermissionLabels: Record<string, string> = {
  READ_WRITE: 'Public Read & Write',
  READ: 'Public View Only',
  PRIVATE: 'Private',
};

export default function FilesList(props: FilesListProps): JSX.Element {
  const { firebaseUser } = useUserContext();
  invariant(!!firebaseUser);
  const formatCreationTime = (creationTime: number | null): string => {
    if (!creationTime) return 'Unknown';
    // return String(creationTime);
    // if recent then display time ago
    if (+dayjs() - +dayjs(creationTime) <= 1000 * 60 * 60 * 24 * 2)
      // <= two days
      return dayjs(creationTime).fromNow();
    return dayjs(creationTime).format('MM/DD/YYYY'); // otherwise display date
  };

  const formatLanguage = (language: string | null): string => {
    if (language == 'py') return 'Python';
    if (language == 'java') return 'Java';
    if (language == 'cpp') return 'C++';
    return 'Unknown';
  };

  const handleToggleHideFile = (file: File) => {
    update(ref(getDatabase(), `users/${firebaseUser.uid}/files/${file.id}`), {
      hidden: !file.hidden,
    });
  };

  return (
    <div className="flex flex-col overflow-x-auto">
      <table className="table-filelist divide-y divide-[color:var(--border-muted)] theme-table">
        <thead className="z-20 theme-table-header">
          <tr className="truncate">
            <th className="text-left text-sm font-bold theme-text max-w-60 truncate">
              Name
            </th>
            <th className="text-left text-sm font-bold theme-text">
              Last Accessed
            </th>
            <th className="text-left text-sm font-bold theme-text">
              Created
            </th>
            <th className="text-left text-sm font-bold theme-text">
              Language
            </th>
            <th className="text-left text-sm font-bold theme-text">Owner</th>
            <th className="text-left text-sm font-bold theme-text">
              Permissions
            </th>
            <th className="relative">
              <span className="sr-only">Edit</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--border-muted)] theme-surface-muted">
          {props.files.map(file => (
            <tr key={file.id}>
              {file.hidden ? (
                <td
                  className={`text-sm font-medium truncate ${
                    file.hidden
                      ? 'text-[color:var(--text-muted)]'
                      : 'text-[color:var(--text-primary)]'
                  }`}
                >
                  <span>(Hidden) {file.title || '(Unnamed File)'}</span>
                </td>
              ) : (
                <td className="relative px-4 py-2">
                  <span className="invisible block">
                    {file.title && file.title.trim() !== ''
                      ? file.title
                      : '(Unnamed File)'}
                  </span>
                  <Link
                    href={`/${file.id.substring(1)}`}
                    className="absolute inset-0 flex items-center text-sm font-medium theme-text hover:bg-[color:var(--surface-hover)] transition whitespace-normal break-words px-4 py-2"
                    aria-label={
                      file.title && file.title.trim() !== ''
                        ? file.title
                        : '(Unnamed File)'
                    }
                  >
                    <span className="block w-full">
                      {file.title && file.title.trim() !== ''
                        ? file.title
                        : '(Unnamed File)'}
                    </span>
                  </Link>
                </td>
              )}
              <td className="whitespace-nowrap text-sm theme-text-muted">
                {dayjs(file.lastAccessTime).fromNow()}
              </td>
              <td className="whitespace-nowrap text-sm theme-text-muted">
                {formatCreationTime(file.creationTime)}
              </td>
              <td className="whitespace-nowrap text-sm theme-text-muted">
                {formatLanguage(file.language)}
              </td>
              <td className="whitespace-nowrap text-sm theme-text-muted">
                {file.owner
                  ? file.owner.id === firebaseUser.uid
                    ? 'Me'
                    : file.owner.name
                  : ''}
              </td>
              <td className="whitespace-nowrap text-sm theme-text-muted">
                {file.lastPermission && file.lastPermission in permissionLabels
                  ? permissionLabels[file.lastPermission]
                  : 'Unknown'}
              </td>
              <td className="relative whitespace-nowrap text-right text-sm font-medium">
                <button
                  className="text-[color:var(--accent-hover)] hover:text-[color:var(--accent)]"
                  onClick={() => handleToggleHideFile(file)}
                >
                  {file.hidden ? 'Unhide' : 'Hide'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
