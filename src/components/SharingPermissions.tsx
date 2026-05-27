import React from 'react';
import { RadioGroupContents } from './settings/RadioGroupContents';

const sharingOptions: {
  label: string;
  value: 'READ_WRITE' | 'READ' | 'PRIVATE';
}[] = [
  {
    label: 'Public Read & Write',
    value: 'READ_WRITE',
  },
  {
    label: 'Public View Only',
    value: 'READ',
  },
  {
    label: 'Private',
    value: 'PRIVATE',
  },
];

export const SharingPermissions = ({
  value,
  onChange,
  isOwner,
  lightMode,
  className,
}: {
  value: 'READ_WRITE' | 'READ' | 'PRIVATE' | null;
  onChange: (newVal: 'READ_WRITE' | 'READ' | 'PRIVATE') => void;
  isOwner: boolean;
  lightMode?: boolean;
  className?: string;
}): JSX.Element => {
  return (
    <RadioGroupContents
      // szda re-theme phase2: sharing permission colors are centralized in RadioGroupContents.
      title="Sharing permissions"
      value={value}
      onChange={onChange}
      disabled={!isOwner}
      options={sharingOptions}
      lightMode={lightMode}
      className={className}
    />
  );
};
