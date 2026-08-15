import ReactTimeAgo from 'react-time-ago';
import React from 'react';

// prettier-ignore
const TimeAgoLabel = ({ date, compact = false }: { date: Date; compact?: boolean }) => {
  return (
    <span
      className="underline underline-offset-2 decoration-dotted"
      title={date.toLocaleString('en')}
    >
      <ReactTimeAgo
        date={date}
        locale="en-US"
        timeStyle={compact ? 'mini' : 'facebook'}
      />
    </span>
  );
};

export default TimeAgoLabel;
