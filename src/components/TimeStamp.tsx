import ReactTimeAgo from 'react-time-ago';
import React from 'react';

const TimeAgoLabel = ({ date }: { date: Date }) => {
  return (
    <span
      className="underline underline-offset-2 decoration-dotted"
      title={date.toLocaleString('en')}
    >
      <ReactTimeAgo date={date} locale="en-US" timeStyle="facebook" />
    </span>
  );
};

export default TimeAgoLabel;
