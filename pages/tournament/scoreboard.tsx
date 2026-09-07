import { useEffect, useState } from 'react';
import { get, getDatabase, ref, onValue } from 'firebase/database';
import classNames from 'classnames';
import WithAdminLogin from '../../src/components/WithAdminLogin';
import LoadingIndicator from '../../src/components/LoadingIndicator';

type Participation = {
  submissionTime: number | null;
  statusCode: string;
  message: string;
  fileID: string;
};

const colorForStatus = (statusCode: string, message: string) => {
  if (statusCode == 'resolved')
    return message == 'correct answer'
      ? 'bg-[color:var(--success)] text-[color:var(--text-inverted)]'
      : 'bg-[color:var(--danger)] text-[color:var(--text-inverted)]';

  return 'theme-table-row';
};

const PageContent = () => {
  const db = getDatabase();

  const [tournamentID, setTournamentID] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<number | null>(null);

  const [data, setData] = useState<
    ({ id: string; name: string } & Participation)[]
  >([]);
  const [names, setNames] = useState<{ [key: string]: string }>({});
  const [ranks, setRanks] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const fetchTournamentData = async () => {
      const latestIDSnapshot = await get(ref(db, 'tournaments/latestID'));
      const tournamentID = latestIDSnapshot.val();
      setTournamentID(tournamentID);

      const tournamentInfoSnapshot = await get(
        ref(db, `tournaments/${tournamentID}/info`)
      );
      const startDate = new Date(tournamentInfoSnapshot.val().start).getTime();
      setStartDate(startDate);
    };

    fetchTournamentData();
  }, []);

  useEffect(() => {
    if (tournamentID === null || startDate === null) return;

    const participantsRef = ref(db, `tournaments/${tournamentID}/participants`);

    const cancel = onValue(participantsRef, async snapshot => {
      const participants: [string, Participation][] = Object.entries(
        snapshot.val() ?? {}
      );

      const untriedTime = new Date().getTime();
      participants.sort((a, b) => {
        return (
          (a[1].submissionTime ?? untriedTime) -
          (b[1].submissionTime ?? untriedTime)
        );
      });

      const newNames = await Promise.all(
        participants
          .filter(([userID, _]) => !names[userID])
          .map(async ([userID, participation]) => {
            const snapshot = await get(
              ref(db, `files/${participation.fileID}/users/${userID}/name`)
            );
            return { [userID]: snapshot.val() as string };
          })
      );

      const allNames = Object.assign(names, ...newNames);
      setNames(allNames);

      const ranks: { [key: string]: number } = {};
      let rank = 1;
      participants.forEach(([id, participation]) => {
        if (participation.message === 'correct answer') {
          ranks[id] = rank++;
        }
      });
      setRanks(ranks);

      setData(
        participants.map(([id, participation]) => ({
          id,
          name: allNames[id],
          ...participation,
        }))
      );
    });

    return () => cancel();
  }, [tournamentID, startDate]);

  return (
    <div className="mx-auto max-w-7xl mt-4 space-y-4 px-2 theme-page">
      <div className="border theme-border overflow-auto max-h-[40rem]">
        {startDate === null ? (
          <LoadingIndicator className="h-4 w-4" />
        ) : (
          <table className="table-auto data-table theme-table text-sm w-full !border-separate !border-spacing-0 divide-y divide-[color:var(--border-color)]">
            <thead>
              <tr className="divide-x divide-[color:var(--border-muted)] theme-table-header">
                <th className="px-4 py-2 w-1/6">Rank</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-color)]">
              {data.map((row, index) => (
                <tr
                  className={classNames(
                    'divide-x',
                    'divide-[color:var(--border-color)]',
                    colorForStatus(row.statusCode, row.message)
                  )}
                  key={index}
                >
                  <td className="px-4 py-2 text-center">
                    {ranks[row.id] ?? '-'}
                  </td>
                  <td className="px-4 py-2">
                    <a
                      className="underline text-[color:var(--accent)] hover:text-[color:var(--accent-hover)] mr-2"
                      href={`/${row.fileID.slice(1)}`}
                    >
                      {row.name}
                    </a>
                  </td>
                  <td className="px-2 py-2">{row.message}</td>
                  <td className="px-4 py-2">
                    {row.submissionTime ? (
                      <span>
                        {Math.floor((row.submissionTime - startDate) / 60000)}:
                        {Math.floor(
                          ((row.submissionTime - startDate) / 1000) % 60
                        )
                          .toString()
                          .padStart(2, '0')}
                      </span>
                    ) : (
                      <span className="theme-text-muted">no submission</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default function Scoreboard() {
  return (
    <WithAdminLogin>
      <PageContent />
    </WithAdminLogin>
  );
}
