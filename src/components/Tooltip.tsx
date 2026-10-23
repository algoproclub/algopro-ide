import { cloneElement, type ReactElement, useId, useState } from 'react';
import {
  autoUpdate,
  flip,
  limitShift,
  offset,
  shift,
  useFloating,
  arrow,
} from '@floating-ui/react-dom';
import { createPortal } from 'react-dom';

type TooltipProps = {
  label: string;
  children: ReactElement<{
    'aria-describedby'?: string;
    'aria-label'?: string;
  }>;
};

export default function Tooltip({ label, children }: TooltipProps) {
  const tooltipId = useId();
  const [reference, setReference] = useState<HTMLSpanElement | null>(null);
  const [popper, setPopper] = useState<HTMLSpanElement | null>(null);
  const [arrowElement, setArrowElement] = useState<HTMLSpanElement | null>(
    null
  );
  const [isOpen, setIsOpen] = useState(false);
  const { floatingStyles, middlewareData, placement } = useFloating({
    elements: { reference, floating: popper },
    whileElementsMounted: autoUpdate,
    placement: 'bottom',
    middleware: [
      offset(10),
      flip({ fallbackPlacements: ['top'] }),
      shift({ limiter: limitShift() }),
      arrow({ element: arrowElement, padding: 4 }),
    ],
  });

  const describedBy = [
    children.props['aria-describedby'],
    isOpen ? tooltipId : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  const tooltip = (
    <span
      ref={setPopper}
      id={tooltipId}
      role="tooltip"
      className="pointer-events-none z-[100] whitespace-nowrap rounded bg-[var(--surface-bg-raised)] px-2.5 py-1.5 text-sm text-[color:var(--text-primary)] shadow-md"
      style={floatingStyles}
      data-placement={placement}
    >
      {label}
      <span
        ref={setArrowElement}
        className="tooltip-arrow"
        style={{ left: middlewareData.arrow?.x, top: middlewareData.arrow?.y }}
      />
    </span>
  );

  return (
    <span
      ref={setReference}
      className="inline-flex"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      {cloneElement(children, {
        'aria-describedby': describedBy,
        'aria-label': children.props['aria-label'] ?? label,
      })}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(tooltip, document.body)}
    </span>
  );
}
