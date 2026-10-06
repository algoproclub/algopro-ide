import { AcademicCapIcon, UserGroupIcon } from '@heroicons/react/20/solid';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { MessagePage } from '../../src/components/MessagePage';
import PageTitle from '../../src/components/PageTitle';
import PlatformProgressSection from '../../src/components/UserProfile/PlatformProgressSection';
import ProfileSection from '../../src/components/UserProfile/ProfileSection';
import UserFilesSection from '../../src/components/UserProfile/UserFilesSection';
import WithTeacherLogin from '../../src/components/WithTeacherLogin';
import { useUserContext } from '../../src/context/UserContext';
import {
  fetchStudentProfile,
  ProfileAccessError,
  type StudentProfile,
} from '../../src/data/userProfile';

type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: StudentProfile }
  | { status: 'error'; message: string };

const deniedMessage = 'You cannot view this student.';

const PageContent = ({ userID }: { userID: string }) => {
  const { userRole } = useUserContext();
  const [state, setState] = useState<ProfileState>({ status: 'loading' });

  useEffect(() => {
    let isCurrent = true;
    fetchStudentProfile(userID).then(
      profile => {
        if (isCurrent) setState({ status: 'ready', profile });
      },
      error => {
        // A refused profile is an expected outcome, not a fault worth logging.
        if (!(error instanceof ProfileAccessError)) console.error(error);
        if (isCurrent)
          setState({
            status: 'error',
            message:
              error instanceof ProfileAccessError
                ? error.message
                : 'The student profile could not be loaded.',
          });
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [userID]);

  if (state.status === 'loading')
    return <MessagePage message="Loading…" showHomeButton={false} />;
  if (state.status === 'error') return <MessagePage message={state.message} />;

  const { profile } = state;
  const isInTeacherSchool = profile.schools.some(school =>
    userRole?.teacher?.includes(school.id)
  );
  if (userRole?.admin !== true && !isInTeacherSchool)
    return <MessagePage message={deniedMessage} />;

  return (
    <div className="bg-canvas px-3 pb-8 text-content">
      <PageTitle>{profile.name}</PageTitle>
      <main className="mx-auto mt-4 max-w-5xl space-y-3">
        <header className="rounded-lg border border-line bg-surface-raised px-4 py-3">
          <h1 className="m-0 text-2xl font-semibold">{profile.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {profile.schools.length ? (
              profile.schools.map(school => (
                <span
                  key={school.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-sm text-content-secondary"
                  title={school.id}
                >
                  <AcademicCapIcon
                    className="h-4 w-4 text-content-muted"
                    aria-hidden="true"
                  />
                  {school.name}
                </span>
              ))
            ) : (
              <span className="text-sm text-content-muted">
                Not a member of any school.
              </span>
            )}
          </div>
        </header>

        <ProfileSection title="Student data" defaultOpen>
          {() =>
            profile.fields.length ? (
              <dl className="grid gap-x-6 gap-y-3 px-4 py-3 text-sm sm:grid-cols-2">
                {profile.fields.map(field => (
                  <div key={field.key} className="min-w-0">
                    <dt className="text-xs text-content-muted">
                      {field.label}
                    </dt>
                    <dd className="m-0 truncate" title={field.value}>
                      {field.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-content-muted">
                No profile data is stored for this student.
              </p>
            )
          }
        </ProfileSection>

        <section className="overflow-hidden rounded-lg border border-line bg-surface-raised">
          <h2 className="m-0 border-b border-line-muted px-3 py-2.5 text-base font-semibold">
            Groups
          </h2>
          <div className="divide-y divide-line-muted">
            {profile.groups.map(group => (
              <article key={group.id} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <UserGroupIcon
                    className="h-4 w-4 shrink-0 text-content-muted"
                    aria-hidden="true"
                  />
                  <Link
                    href={`/groups/${group.id}`}
                    className="truncate font-medium hover:text-accent-hover hover:underline"
                  >
                    {group.name}
                  </Link>
                  <span className="truncate text-sm text-content-muted">
                    {group.schoolName}
                  </span>
                </div>
                <p className="m-0 truncate pl-6 text-xs text-content-muted">
                  {group.id}
                </p>
              </article>
            ))}
            {!profile.groups.length && (
              <p className="px-4 py-6 text-center text-sm text-content-muted">
                This student is not a member of any group.
              </p>
            )}
          </div>
        </section>

        <ProfileSection title="Files">
          {open => <UserFilesSection userID={profile.id} active={open} />}
        </ProfileSection>

        <PlatformProgressSection userID={profile.id} />
      </main>
    </div>
  );
};

export default function UserProfilePage() {
  const router = useRouter();
  const userID = typeof router.query.id === 'string' ? router.query.id : null;

  return (
    <>
      <PageTitle>Student</PageTitle>
      <WithTeacherLogin>
        {userID ? (
          <PageContent key={userID} userID={userID} />
        ) : (
          <MessagePage message="Loading…" showHomeButton={false} />
        )}
      </WithTeacherLogin>
    </>
  );
}
