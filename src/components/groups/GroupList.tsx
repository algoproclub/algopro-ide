import {
  ArrowRightIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/20/solid';
import type { GroupInfo, School } from '../../data/classroomMetadata';
import type { ClassroomResourceStatus } from '../../hooks/useClassroomMetadata';
import Tooltip from '../Tooltip';

export default function GroupList({
  school,
  hasSchools,
  groups,
  searchQuery,
  onSelectGroup,
  onDeleteGroup,
  onNewGroup,
  status,
}: {
  school: School | undefined;
  hasSchools: boolean;
  groups: GroupInfo[];
  searchQuery: string;
  onSelectGroup: (groupID: string) => void;
  onDeleteGroup: (groupID: string) => void;
  onNewGroup: () => void;
  status: ClassroomResourceStatus;
}) {
  const normalizedQuery = searchQuery.trim();

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-raised text-content">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4">
        <div>
          <h1 className="text-lg font-semibold">{school?.name ?? 'Groups'}</h1>
          <p className="mt-1 text-sm text-content-muted">
            {groups.length} group{groups.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          className="ui-button-primary py-2"
          onClick={onNewGroup}
          disabled={!school || status !== 'ready'}
        >
          <PlusIcon className="h-4 w-4" />
          New group
        </button>
      </header>
      {status === 'error' && (
        <p className="border-b border-danger px-4 py-3 text-sm text-danger">
          {school
            ? 'Groups could not be loaded. Try refreshing them.'
            : 'Schools could not be loaded. Try refreshing them.'}
        </p>
      )}
      <div className="divide-y divide-line-muted bg-surface text-content">
        {groups.map(group => (
          <article
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            key={group.id}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="h-4 w-4 shrink-0 text-content-muted" />
                <h2 className="truncate font-medium">{group.name}</h2>
                {group.inactive && (
                  <span className="rounded-full border border-line px-1.5 py-0.5 text-[0.65rem] text-content-muted">
                    Inactive
                  </span>
                )}
              </div>
              <p className="mt-1 truncate pl-6 text-xs text-content-muted">
                {group.id}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="ui-button-secondary leading-none"
                onClick={() => onSelectGroup(group.id)}
              >
                Open
                <ArrowRightIcon className="h-4 w-4" />
              </button>
              <Tooltip label="Delete group">
                <button
                  type="button"
                  className="ui-icon-button"
                  onClick={() => onDeleteGroup(group.id)}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          </article>
        ))}
        {!groups.length && (
          <p className="px-4 py-10 text-center text-sm text-content-muted">
            {status === 'loading'
              ? school
                ? 'Loading groups…'
                : 'Loading schools…'
              : status === 'error'
                ? 'The list is unavailable.'
                : school
                  ? normalizedQuery
                    ? 'No matching groups.'
                    : 'No groups in this school yet.'
                  : hasSchools
                    ? 'Select a school to view groups.'
                    : 'No schools are available.'}
          </p>
        )}
      </div>
    </div>
  );
}
