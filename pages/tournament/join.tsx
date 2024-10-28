import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const CountdownTimer = ({ deadline }: { deadline: Date }) => {
  const [remaining, setRemaining] = useState<number>(
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
  const router = useRouter();
  const [starts, setStarts] = useState<Date | null>(null);

  const fetchTournamentInfo = async () => {
    const res = await fetch('/api/tournamentInfo');
    const data = await res.json();

    if ('starts' in data) {
      const startDate = new Date(data.starts);
      setStarts(startDate);

      const reloadID = setInterval(() => {
        clearInterval(reloadID);
        router.reload();
      }, startDate.getTime() - Date.now());
      return;
    }

    // FIXME: Better error handling
    if ('error' in data) {
      console.error(data.error);
      return;
    }

    router.push(
      `/solve/${data.platform}/${data.id}?tournamentID=${data.tournamentID}`
    );
  };

  useEffect(() => {
    fetchTournamentInfo();
  }, []);

  return (
    <div className="p-8 sm:p-16 text-center">
      <div className="text-3xl sm:text-4xl text-white font-bold">
        {starts == null ? (
          <span>Loading...</span>
        ) : (
          <span>
            Tournament starts in <CountdownTimer deadline={starts} />
          </span>
        )}
      </div>
    </div>
  );
}
