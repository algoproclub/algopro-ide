import { Tab } from '@headlessui/react';
import { PlusIcon } from '@heroicons/react/20/solid';
import Fuse from 'fuse.js';
import { type ReactNode, useState } from 'react';
import type {
  GroupClassData,
  GroupInfo,
  School,
} from '../../data/classroomMetadata';
import type { ClassroomResourceStatus } from '../../hooks/useClassroomMetadata';
import RefreshButton from '../RefreshButton';

const searchOptions = { threshold: 0.35, ignoreLocation: true };

export default function GroupsSidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="h-fit rounded-lg border border-line bg-surface-raised text-content lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      {children}
    </aside>
  );
}

export function SchoolSidebarSection({
  schools,
  selectedSchoolID,
  onSelectSchool,
  status,
  isRefreshing,
  onRefresh,
  navigationDisabled,
}: {
  schools: School[];
  selectedSchoolID: string | null;
  onSelectSchool: (schoolID: string) => void;
  status: ClassroomResourceStatus;
  isRefreshing: boolean;
  onRefresh: () => void;
  navigationDisabled: boolean;
}) {
  const [query, setQuery] = useState('');
  const filteredSchools = query.trim()
    ? new Fuse(schools, { keys: ['name', 'id'], ...searchOptions })
        .search(query, { limit: 50 })
        .map(result => result.item)
    : schools;

  return (
    <section className="border-b border-line p-2">
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <p className="text-xs font-medium uppercase tracking-wide text-content-muted">
          Schools
        </p>
        <RefreshButton
          title="Refresh schools"
          onClick={onRefresh}
          disabled={navigationDisabled}
          isLoading={status === 'loading' || isRefreshing}
        />
      </div>
      <input
        type="search"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search schools…"
        className="mb-1 w-full rounded-md border border-line bg-input px-3 py-1.5 text-sm text-content outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
      />
      <div className="max-h-[13rem] overflow-y-auto pr-1">
        {filteredSchools.map(school => (
          <button
            key={school.id}
            type="button"
            className={`ui-focus mt-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${school.id === selectedSchoolID ? 'bg-accent text-content-inverted' : 'hover:bg-surface-hover'}`}
            onClick={() => onSelectSchool(school.id)}
            disabled={navigationDisabled}
          >
            <span className="block truncate">{school.name}</span>
            <span className="block truncate text-xs opacity-70">
              {school.id}
            </span>
          </button>
        ))}
      </div>
      {!filteredSchools.length && (
        <p className="px-2 py-2 text-sm text-content-muted">
          {status === 'loading'
            ? 'Loading schools…'
            : status === 'error'
              ? 'Could not load schools.'
              : query.trim()
                ? 'No matching schools.'
                : 'No schools yet.'}
        </p>
      )}
      {status === 'error' && filteredSchools.length > 0 && (
        <p className="px-2 py-2 text-xs text-danger">
          Refresh failed; showing the previous list.
        </p>
      )}
    </section>
  );
}

export function GroupSidebarSection({
  groups,
  selectedSchoolID,
  selectedGroupID,
  query,
  onQueryChange,
  onSelectGroup,
  onNewGroup,
  status,
  isRefreshing,
  onRefresh,
  canCreateGroup,
  navigationDisabled,
}: {
  groups: GroupInfo[];
  selectedSchoolID: string | null;
  selectedGroupID: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  onSelectGroup: (groupID: string) => void;
  onNewGroup: () => void;
  status: ClassroomResourceStatus;
  isRefreshing: boolean;
  onRefresh: () => void;
  canCreateGroup: boolean;
  navigationDisabled: boolean;
}) {
  return (
    <section className="border-b border-line p-2">
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <p className="text-xs font-medium uppercase tracking-wide text-content-muted">
          Groups
        </p>
        <RefreshButton
          title="Refresh groups"
          onClick={onRefresh}
          disabled={!selectedSchoolID || navigationDisabled}
          isLoading={status === 'loading' || isRefreshing}
        />
      </div>
      <input
        type="search"
        value={query}
        onChange={event => onQueryChange(event.target.value)}
        placeholder="Search groups…"
        className="mb-1 w-full rounded-md border border-line bg-input px-3 py-1.5 text-sm text-content outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
      />
      <div className="max-h-[13rem] overflow-y-auto pr-1">
        {groups.map(group => (
          <button
            key={group.id}
            type="button"
            className={`ui-focus mt-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${group.id === selectedGroupID ? 'bg-accent text-content-inverted' : 'hover:bg-surface-hover'}`}
            onClick={() => onSelectGroup(group.id)}
            disabled={navigationDisabled}
          >
            <span className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate">{group.name}</span>
              {group.inactive && (
                <span className="shrink-0 text-[0.65rem] opacity-75">
                  Inactive
                </span>
              )}
            </span>
            <span className="block truncate text-xs opacity-70">
              {group.id}
            </span>
          </button>
        ))}
      </div>
      {!groups.length && (
        <p className="px-2 py-2 text-sm text-content-muted">
          {status === 'loading'
            ? 'Loading groups…'
            : status === 'error'
              ? 'Could not load groups.'
              : query.trim()
                ? 'No matching groups.'
                : status === 'idle'
                  ? 'Select a school.'
                  : 'No groups yet.'}
        </p>
      )}
      {status === 'error' && groups.length > 0 && (
        <p className="px-2 py-2 text-xs text-danger">
          Refresh failed; showing the previous list.
        </p>
      )}
      <button
        type="button"
        className="ui-button-primary mt-2 w-full py-2"
        onClick={onNewGroup}
        disabled={!canCreateGroup || navigationDisabled}
      >
        <PlusIcon className="h-4 w-4" />
        New group
      </button>
    </section>
  );
}

export function SidebarViewTabs({
  selectedView,
  onSelectView,
  disabled,
}: {
  selectedView: 'members' | 'classes';
  onSelectView: (view: 'members' | 'classes') => void;
  disabled: boolean;
}) {
  return (
    <Tab.Group
      selectedIndex={selectedView === 'members' ? 0 : 1}
      onChange={index => onSelectView(index === 0 ? 'members' : 'classes')}
    >
      <div className="border-b border-line p-2">
        <Tab.List className="grid grid-cols-2 rounded-md bg-surface-muted p-1">
          {(['Members', 'Classes'] as const).map(label => (
            <Tab
              key={label}
              disabled={disabled}
              className={({ selected }) =>
                `rounded px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'bg-accent text-content-inverted shadow-sm' : 'text-content-muted hover:bg-surface-hover hover:text-content'}`
              }
            >
              {label}
            </Tab>
          ))}
        </Tab.List>
      </div>
    </Tab.Group>
  );
}

export function ClassSidebarSection({
  groupID,
  classes,
  selectedClassID,
  onSelectClass,
  onNewClass,
  canCreateClass,
  status,
  navigationDisabled,
}: {
  groupID: string;
  classes: { id: string; data: GroupClassData }[];
  selectedClassID: string | null;
  onSelectClass: (classID: string) => void;
  onNewClass: () => void;
  canCreateClass: boolean;
  status: ClassroomResourceStatus;
  navigationDisabled: boolean;
}) {
  const [search, setSearch] = useState({ groupID, query: '' });
  const query = search.groupID === groupID ? search.query : '';
  const filteredClasses = query.trim()
    ? new Fuse(classes, { keys: ['id'], ...searchOptions })
        .search(query, { limit: 50 })
        .map(result => result.item)
    : classes;

  return (
    <nav className="p-2">
      <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-content-muted">
        Classes
      </p>
      <input
        type="search"
        value={query}
        onChange={event => setSearch({ groupID, query: event.target.value })}
        placeholder="Search classes…"
        className="mb-1 w-full rounded-md border border-line bg-input px-3 py-1.5 text-sm text-content outline-none transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-focus"
      />
      <div className="max-h-44 overflow-y-auto pr-1">
        {filteredClasses.map(({ id, data }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelectClass(id)}
            disabled={navigationDisabled}
            className={`ui-focus mt-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${id === selectedClassID ? 'bg-accent text-content-inverted' : 'hover:bg-surface-hover'}`}
          >
            <span className="truncate">{id}</span>
            <span className="text-xs opacity-75">{data.tasks.length}</span>
          </button>
        ))}
      </div>
      {!filteredClasses.length && (
        <p className="px-2 py-2 text-sm text-content-muted">
          {status === 'loading'
            ? 'Loading classes…'
            : status === 'error'
              ? 'Could not load classes.'
              : query.trim()
                ? 'No matching classes.'
                : 'No classes yet.'}
        </p>
      )}
      {status === 'error' && filteredClasses.length > 0 && (
        <p className="px-2 py-2 text-xs text-danger">
          Refresh failed; showing the previous list.
        </p>
      )}
      <button
        type="button"
        className="ui-button-primary mt-2 w-full py-2"
        onClick={onNewClass}
        disabled={!canCreateClass}
      >
        <PlusIcon className="h-4 w-4" />
        New class
      </button>
    </nav>
  );
}
