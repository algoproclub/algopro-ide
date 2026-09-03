import {
  CheckIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  MinusIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid';

type StatusColor = 'success' | 'danger' | 'warning' | 'accent' | 'muted';
const statusColorClasses: Record<StatusColor, string> = {
  success: 'text-status-success',
  danger: 'text-status-danger',
  warning: 'text-status-warning',
  accent: 'text-status-accent',
  muted: 'text-status-neutral',
};

const statuses = [
  {
    label: 'Accepted',
    color: 'success',
    Icon: CheckIcon,
    description: 'A megoldás minden értékelt teszten helyes.',
  },
  {
    label: 'Incorrect',
    color: 'danger',
    Icon: XMarkIcon,
    description:
      'A program lefutott, de legalább egy tesztre hibás választ adott.',
  },
  {
    label: 'Compile error',
    color: 'danger',
    Icon: XMarkIcon,
    description: 'A program nem fordult le; ellenőrizd a fordító üzeneteit.',
  },
  {
    label: 'Runtime error',
    color: 'danger',
    Icon: XMarkIcon,
    description:
      'A program futás közben hibázott vagy a rendszer kényszerítve leállította.',
  },
  {
    label: 'Time limit',
    color: 'danger',
    Icon: XMarkIcon,
    description: 'A program túllépte az időkorlátot.',
  },
  {
    label: 'Memory limit',
    color: 'danger',
    Icon: XMarkIcon,
    description: 'A program túllépte a memóriakorlátot.',
  },
  {
    label: 'Partially correct',
    color: 'warning',
    Icon: CheckIcon,
    description: 'A részfeladatok vagy tesztek egy része teljesült.',
  },
  {
    label: 'Submission error',
    color: 'warning',
    Icon: ExclamationTriangleIcon,
    description: 'Az értékelő nem tudott érvényes eredményt adni.',
  },
  {
    label: 'Untried',
    color: 'muted',
    Icon: CodeBracketIcon,
    description: 'Van fájl, de még nincs Submit eredménye.',
  },
  {
    label: 'Submitting…',
    color: 'accent',
    Icon: Cog6ToothIcon,
    description: 'Az értékelés folyamatban van; várd meg a végső állapotot.',
    spins: true,
  },
  {
    label: 'No file',
    color: 'muted',
    Icon: MinusIcon,
    description: 'Ehhez a feladathoz még fájl sem készült.',
  },
] as const satisfies ReadonlyArray<{
  label: string;
  color: StatusColor;
  Icon: typeof CheckIcon;
  description: string;
  spins?: boolean;
}>;

export function StatusLegend() {
  return (
    <div
      className="status-legend-scroll not-prose overflow-x-auto"
      role="region"
      aria-label="Státuszjelmagyarázat"
    >
      <table className="status-legend w-full min-w-[42rem] border-collapse text-sm text-content">
        <thead>
          <tr>
            <th
              className="border border-line bg-panel-muted px-3 py-2 text-left font-semibold"
              scope="col"
            >
              Ikon és szín
            </th>
            <th
              className="border border-line bg-panel-muted px-3 py-2 text-left font-semibold"
              scope="col"
            >
              Státusz
            </th>
            <th
              className="border border-line bg-panel-muted px-3 py-2 text-left font-semibold"
              scope="col"
            >
              Jelentés
            </th>
          </tr>
        </thead>
        <tbody>
          {statuses.map(status => {
            const { label, color, Icon, description } = status;
            const spins = 'spins' in status && status.spins;
            return (
              <tr key={label}>
                <td className="border border-line px-3 py-2 align-middle">
                  <Icon
                    aria-label={label}
                    className={`status-icon block h-5 w-5 ${statusColorClasses[color]}${spins ? ' status-icon--spin animate-spin' : ''}`}
                    role="img"
                  />
                </td>
                <td
                  className={`status-label border border-line px-3 py-2 align-middle font-bold ${statusColorClasses[color]}`}
                >
                  {label}
                </td>
                <td className="border border-line px-3 py-2 align-middle text-content-secondary">
                  {description}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
