import { ChatMessage } from './Chat';
import { User } from '../hooks/useOnlineUsers';
import React from 'react';

export const ChatMessageItem = ({
  chatMessage,
  user,
}: {
  chatMessage: ChatMessage;
  user: User | null;
}): JSX.Element => {
  return (
    <p className="theme-text text-sm leading-4 break-words">
      <span style={user?.color ? { color: user?.color } : undefined}>
        {user?.name || 'Unknown User'}
      </span>
      : {chatMessage.message}
    </p>
  );
};
