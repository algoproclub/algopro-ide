import React from 'react';

const Checkbox = ({
  enabled,
  label,
  toggleEnabled,
}: {
  enabled: boolean;
  label: string;
  toggleEnabled: () => void;
}) => {
  return (
    <label className="text-[0.85rem] text-white flex items-center select-none w-fit">
      <input
        checked={enabled}
        onChange={toggleEnabled}
        type="checkbox"
        className="w-4 h-4 bg-gray-900 checked:bg-indigo-600 checked:focus:bg-indigo-600 checked:focus:hover:bg-indigo-700 checked:hover:bg-indigo-700 focus:ring-0 focus:ring-offset-0"
      />
      <span className="ml-2 mb-0.5">{label}</span>
    </label>
  );
};

export default Checkbox;
