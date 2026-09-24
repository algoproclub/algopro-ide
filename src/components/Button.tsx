import classNames from 'classnames';
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';

type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconPosition?: 'start' | 'end';
};

const baseClasses =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-50';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-accent text-content-inverted shadow-sm enabled:hover:bg-accent-strong enabled:active:bg-accent-strong',
  secondary:
    'border-line bg-control text-content shadow-sm enabled:hover:border-line-strong enabled:hover:bg-surface-hover enabled:active:bg-surface-active',
  danger:
    'border-transparent bg-action-danger text-content-inverted shadow-sm enabled:hover:bg-action-danger-hover enabled:active:bg-action-danger-hover',
  success:
    'border-transparent bg-action-success text-content-inverted shadow-sm enabled:hover:bg-action-success-hover enabled:active:bg-action-success-hover',
  ghost:
    'border-transparent text-content-secondary enabled:hover:bg-surface-hover enabled:hover:text-content enabled:active:bg-surface-active',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-2.5 text-sm',
};

const iconOnlySizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 w-8 p-0',
  md: 'h-9 w-9 p-0',
  lg: 'h-10 w-10 p-0',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-4 w-4 shrink-0',
  md: 'h-5 w-5 shrink-0',
  lg: 'h-5 w-5 shrink-0',
};

export const Button = ({
  children,
  className,
  icon: Icon,
  iconPosition = 'start',
  size = 'md',
  variant = 'secondary',
  ...buttonProps
}: ButtonProps): JSX.Element => {
  const isIconOnly = Icon !== undefined && children == null;
  const icon = Icon ? (
    <Icon aria-hidden="true" className={iconSizeClasses[size]} />
  ) : null;

  return (
    <button
      {...buttonProps}
      className={classNames(
        baseClasses,
        variantClasses[variant],
        isIconOnly ? iconOnlySizeClasses[size] : sizeClasses[size],
        className
      )}
    >
      {iconPosition === 'start' && icon}
      {children}
      {iconPosition === 'end' && icon}
    </button>
  );
};
