import type { TaskStatusState } from '../../data/taskStatus';
import { getTaskStatusDisplay } from './statusDisplay';

export default function TaskStatusIndicator({
  state,
  untriedColor = 'muted',
  onTintedBackground = false,
}: {
  state: TaskStatusState;
  untriedColor?: 'accent' | 'muted';
  onTintedBackground?: boolean;
}) {
  const display = getTaskStatusDisplay(state, untriedColor);
  const { label, Icon, spins } = display;
  const textClass = onTintedBackground
    ? display.surfaceTextClass
    : display.standaloneClass;

  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 font-medium ${display.colorClass}`}
      title={
        state.status === 'ready' && state.data
          ? (state.data.message ?? label)
          : label
      }
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${display.standaloneClass} ${spins ? 'animate-spin' : ''}`}
      />
      <span className={`truncate ${textClass}`}>{label}</span>
    </span>
  );
}
