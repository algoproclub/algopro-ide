import React from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
import { permissionLabels } from '../UserList/UserListItem';
import invariant from 'tiny-invariant';
import { useUserContext } from '../../context/UserContext';
import { update, ref, getDatabase } from 'firebase/database';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Button } from '../Button';

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
    <div className="w-full max-w-full overflow-x-auto">
      <table className="table-filelist w-full border-line bg-canvas text-sm text-content">
        <thead className="border-b border-line bg-panel-muted text-content">
          <tr className="truncate">
            <th className="ui-table-heading max-w-60 truncate">Name</th>
            <th className="ui-table-heading whitespace-nowrap">
              Last accessed
            </th>
            <th className="ui-table-heading">Created</th>
            <th className="ui-table-heading">Language</th>
            <th className="ui-table-heading">Owner</th>
            <th className="ui-table-heading">Permissions</th>
            <th className="relative">
              <span className="sr-only">Visibility</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-muted bg-canvas text-content">
          {props.files.map(file => (
            <tr
              key={file.id}
              className={`group relative transition-colors focus-within:bg-panel-muted ${
                file.hidden
                  ? ''
                  : 'hover:bg-panel-muted active:bg-surface-hover'
              }`}
            >
              {file.hidden ? (
                <td className="truncate text-sm font-medium text-content-muted">
                  <span>(Hidden) {file.title || '(Unnamed File)'}</span>
                </td>
              ) : (
                <td className="px-4 py-2">
                  <span className="invisible block">
                    {file.title && file.title.trim() !== ''
                      ? file.title
                      : '(Unnamed File)'}
                  </span>
                  <Link
                    href={`/${file.id.substring(1)}`}
                    className="absolute inset-0 flex items-center whitespace-normal break-words px-4 py-2 text-sm font-medium transition-colors theme-text"
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
                <Button
                  variant="ghost"
                  size="sm"
                  icon={file.hidden ? EyeIcon : EyeSlashIcon}
                  className="relative z-10"
                  onClick={() => handleToggleHideFile(file)}
                >
                  {file.hidden ? 'Unhide' : 'Hide'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
