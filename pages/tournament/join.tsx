import { useEffect, useState } from 'react';
import Router from 'next/router';

const CountdownTimer = ({ deadline }: { deadline: Date }) => {
  const [remaining, setRemaining] = useState(() =>
    Math.ceil((deadline.getTime() - Date.now()) / 1000)
  );

  useEffect(() => {
    const timerID = setInterval(() => {
      if (remaining == 0) {
        clearInterval(timerID);
        return;
      }
      setRemaining(() => remaining - 1);
    }, 1000);

    return () => clearInterval(timerID);
  }, [remaining]);

  const toHHMMSS = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return [hours, minutes, remainingSeconds]
      .map(unit => unit.toString().padStart(2, '0'))
      .join(':');
  };

  return <span className="font-mono">{toHHMMSS(remaining)}</span>;
};

export default function JoinTournament() {
  const [start, setStart] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    let reloadID: ReturnType<typeof setTimeout> | undefined;

    fetch('/api/tournamentInfo')
      .then(res => res.json())
      .then(data => {
        if (!active) return;

        if ('start' in data) {
          const startDate = new Date(data.start);
          setStart(startDate);
          reloadID = setTimeout(
            () => Router.reload(),
            startDate.getTime() - Date.now()
          );
          return;
        }

        // FIXME: Better error handling
        if ('error' in data) {
          console.error(data.error);
          return;
        }

        void Router.push(
          `/solve/${data.platform}/${data.id}?tournamentID=${data.tournamentID}`
        );
      });

    return () => {
      active = false;
      clearTimeout(reloadID);
    };
  }, []);

  return (
    <div className="p-8 sm:p-16 text-center h-full theme-page">
      <div className="text-3xl sm:text-4xl theme-text font-bold">
        {start == null ? (
          <span>Loading…</span>
        ) : (
          <span>
            Tournament starts in <CountdownTimer deadline={start} />
          </span>
        )}
      </div>
    </div>
  );
}
