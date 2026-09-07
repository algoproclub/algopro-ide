import {
  CheckIcon,
  CodeBracketIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  MinusIcon,
  QuestionMarkCircleIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid';
import {
  getSubmissionOutcome,
  getVerdictOutcome,
  isSubmissionPending,
  type SubmissionOutcome,
} from '../../data/submissionStatus';
import type { TaskStatusState } from '../../data/taskStatus';
import type { StatusData } from '../../types/problem';
import styles from './statusDisplay.module.css';

export type StatusColor = 'success' | 'danger' | 'warning' | 'accent' | 'muted';

type StatusDisplay = {
  label: string;
  Icon: typeof MinusIcon;
  color: StatusColor;
  standaloneClass: string;
  surfaceTextClass: string;
  badgeSurfaceClass: string;
  badgeBorderClass: string;
  colorClass: string;
  spins?: boolean;
};

const buildStatusDisplay = (
  display: Omit<
    StatusDisplay,
    | 'standaloneClass'
    | 'surfaceTextClass'
    | 'badgeSurfaceClass'
    | 'badgeBorderClass'
    | 'colorClass'
  >
): StatusDisplay => ({
  ...display,
  standaloneClass: styles.standalone,
  surfaceTextClass: styles.surfaceText,
  badgeSurfaceClass: styles.badgeSurface,
  badgeBorderClass: styles.badgeBorder,
  colorClass: styles[display.color],
});

const outcomeDisplays: Record<
  SubmissionOutcome,
  Omit<
    StatusDisplay,
    | 'standaloneClass'
    | 'surfaceTextClass'
    | 'badgeSurfaceClass'
    | 'badgeBorderClass'
    | 'colorClass'
  >
> = {
  accepted: { label: 'Accepted', Icon: CheckIcon, color: 'success' },
  incorrect: { label: 'Incorrect', Icon: XMarkIcon, color: 'danger' },
  'compile-error': {
    label: 'Compile error',
    Icon: XMarkIcon,
    color: 'danger',
  },
  'runtime-error': {
    label: 'Runtime error',
    Icon: XMarkIcon,
    color: 'danger',
  },
  'time-limit': {
    label: 'Time limit',
    Icon: XMarkIcon,
    color: 'danger',
  },
  'memory-limit': {
    label: 'Memory limit',
    Icon: XMarkIcon,
    color: 'danger',
  },
  partial: { label: 'Partially correct', Icon: CheckIcon, color: 'warning' },
  'submission-error': {
    label: 'Submission error',
    Icon: ExclamationTriangleIcon,
    color: 'warning',
  },
  untried: { label: 'Untried', Icon: CodeBracketIcon, color: 'muted' },
};

const submittingDisplay = buildStatusDisplay({
  label: 'Submitting…',
  Icon: Cog6ToothIcon,
  color: 'accent',
  spins: true,
});

export const getOutcomeDisplay = (
  outcome: SubmissionOutcome,
  untriedColor: 'accent' | 'muted' = 'muted'
) => {
  const display = outcomeDisplays[outcome];
  return buildStatusDisplay({
    ...display,
    color: outcome === 'untried' ? untriedColor : display.color,
  });
};

export const getSubmissionStatusDisplay = (data: StatusData): StatusDisplay => {
  if (isSubmissionPending(data)) return submittingDisplay;
  return getOutcomeDisplay(getSubmissionOutcome(data));
};

export const getTestCaseStatusDisplay = (title: string) => {
  if (['did not run', 'skipped'].includes(title.toLowerCase())) {
    return buildStatusDisplay({
      label: title,
      Icon: QuestionMarkCircleIcon,
      color: 'muted',
    });
  }
  return getOutcomeDisplay(getVerdictOutcome(title));
};

export const getTaskStatusDisplay = (
  state: TaskStatusState,
  untriedColor: 'accent' | 'muted' = 'muted'
): StatusDisplay => {
  if (state.status === 'loading') {
    return buildStatusDisplay({
      label: 'Loading…',
      Icon: MinusIcon,
      color: 'muted',
    });
  }
  if (state.status === 'error') {
    return buildStatusDisplay({
      label: 'Unavailable',
      Icon: ExclamationTriangleIcon,
      color: 'warning',
    });
  }
  if (!state.data) {
    return buildStatusDisplay({
      label: 'No file',
      Icon: MinusIcon,
      color: 'muted',
    });
  }
  if (state.data.isSubmitting) return submittingDisplay;
  return getOutcomeDisplay(state.data.outcome, untriedColor);
};
