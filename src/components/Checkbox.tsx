import React from 'react';

const Checkbox = ({
  checked,
  label,
  toggleChecked,
}: {
  checked: boolean;
  label: string;
  toggleChecked: () => void;
}) => {
  return (
    <label className="text-[0.85rem] theme-text flex items-center select-none w-fit">
      <input
        checked={checked}
        onChange={toggleChecked}
        type="checkbox"
        // szda re-theme phase2: shared checkbox uses accent and input tokens.
        className="w-4 h-4 bg-[var(--input-bg)] border-[var(--border-color)] checked:bg-[var(--accent)] checked:focus:bg-[var(--accent)] checked:focus:hover:bg-[var(--accent-hover)] checked:hover:bg-[var(--accent-hover)] focus:ring-0 focus:ring-offset-0"
      />
      <span className="ml-2 mb-0.5">{label}</span>
    </label>
  );
};

export default Checkbox;
