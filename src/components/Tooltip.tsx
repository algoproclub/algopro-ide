import { cloneElement, type ReactElement, useId, useState } from 'react';
import { usePopper } from 'react-popper';
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
  const [isOpen, setIsOpen] = useState(false);
  const { styles, attributes } = usePopper(reference, popper, {
    placement: 'bottom',
    modifiers: [
      { name: 'offset', options: { offset: [0, 10] } },
      { name: 'flip', options: { fallbackPlacements: ['top'] } },
      { name: 'arrow', options: { padding: 4 } },
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
      style={styles.popper}
      {...attributes.popper}
    >
      {label}
      <span
        data-popper-arrow
        className="tooltip-arrow"
        style={styles.arrow}
        {...attributes.arrow}
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
