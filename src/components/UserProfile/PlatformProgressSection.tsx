import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  fetchPlatformProgress,
  type PlatformProgress,
} from '../../data/userProfile';
import { getOutcomeDisplay } from '../TaskStatus/statusDisplay';
import ProfileSection from './ProfileSection';

const solvedDisplay = getOutcomeDisplay('accepted');
const openedDisplay = getOutcomeDisplay('untried');

const ProblemGrid = ({ progress }: { progress: PlatformProgress }) => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-1.5 p-3">
    {progress.openedProblems.map(problem => {
      const isSolved = progress.solvedIDs.has(problem.id);
      const display = isSolved ? solvedDisplay : openedDisplay;
      return (
        <Link
          key={problem.id}
          href={`/${problem.fileID.slice(1)}`}
          prefetch={false}
          title={`${problem.id} — ${isSolved ? 'solved' : 'not solved'}`}
          className={`ui-focus truncate rounded border border-transparent px-2 py-1 text-center font-mono text-xs transition-colors hover:border-[color:var(--status-color)] ${display.colorClass} ${display.badgeSurfaceClass}`}
        >
          {problem.id}
        </Link>
      );
    })}
  </div>
);

export default function PlatformProgressSection({
  userID,
}: {
  userID: string;
}) {
  const [progress, setProgress] = useState<PlatformProgress[] | null>(null);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    fetchPlatformProgress(userID).then(
      loaded => {
        if (isCurrent) setProgress(loaded);
      },
      error => {
        console.error(error);
        if (isCurrent) setHasFailed(true);
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [userID]);

  const visiblePlatforms = (progress ?? []).filter(
    platform =>
      platform.openedProblems.length > 0 || platform.solvedIDs.size > 0
  );

  return (
    <div className="space-y-2">
      <h2 className="m-0 text-base font-semibold">Platform progress</h2>
      {visiblePlatforms.map(platform => (
        <ProfileSection
          key={platform.platform}
          title={platform.name}
          headingLevel="h3"
          summary={
            <>
              <span>{platform.openedProblems.length} opened</span>
              <span aria-hidden="true">·</span>
              <span>{platform.solvedIDs.size} solved</span>
            </>
          }
        >
          {() =>
            platform.openedProblems.length ? (
              <ProblemGrid progress={platform} />
            ) : (
              <p className="px-3 py-6 text-center text-sm text-content-muted">
                This student has no open files on this platform.
              </p>
            )
          }
        </ProfileSection>
      ))}
      {!visiblePlatforms.length && (
        <p className="rounded-lg border border-line bg-surface-raised px-3 py-6 text-center text-sm text-content-muted">
          {hasFailed
            ? 'Platform progress could not be loaded.'
            : progress
              ? 'This student has not opened any platform problems yet.'
              : 'Loading platform progress…'}
        </p>
      )}
    </div>
  );
}
