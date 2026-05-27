import classNames from 'classnames';
import React, { FormEvent, useLayoutEffect, useRef, useState } from 'react';
import { getDatabase, ref, push, serverTimestamp } from 'firebase/database';
import { useOnlineUsers } from '../hooks/useOnlineUsers';
import { ChatMessageItem } from './ChatMessageItem';
import useUserPermission from '../hooks/useUserPermission';
import { useEditorContext } from '../context/EditorContext';
import { useUserContext } from '../context/UserContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export interface ChatMessage {
  timestamp: number;
  userId: string;
  message: string;
  key: string;
}

export const Chat = ({ className }: { className?: string }): JSX.Element => {
  const onlineUsers = useOnlineUsers();
  const userPermission = useUserPermission();
  const chatRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState('');
  const { fileData } = useEditorContext();
  const { userData } = useUserContext();

  const chatMessages = Object.entries(fileData.chat || {}).map(
    ([key, message]) => ({
      key,
      ...message,
    })
  );

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (message.trim() === '') return;

    push(ref(getDatabase(), `files/${fileData.id}/chat`), {
      timestamp: serverTimestamp(),
      userId: userData.id,
      message: message.trim(),
    });
    setMessage('');
    chatInputRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={classNames(className, 'flex flex-col mx-3 my-3')}>
      {/* szda re-theme phase2: chat surfaces use shared panel and input tokens. */}
      <div className="font-bold text-sm theme-text py-2.5 px-4 rounded-t-md border theme-border theme-surface-raised">
        Chat
      </div>
      <div
        className="flex-1 space-y-1 min-h-0 overflow-y-auto theme-border border border-t-0 p-2 theme-surface-muted"
        ref={chatRef}
      >
        {chatMessages &&
          (chatMessages.length > 0 ? (
            chatMessages.map(message => (
              <ChatMessageItem
                user={
                  onlineUsers?.find(user => user.id === message.userId) || null
                }
                chatMessage={message}
                key={message.key}
              />
            ))
          ) : (
            <p className="theme-text-muted text-sm">No chat messages.</p>
          ))}
      </div>
      {(userPermission === 'OWNER' || userPermission === 'READ_WRITE') && (
        <form onSubmit={handleSubmit}>
          <textarea
            className="mt-2 block w-full theme-input px-3 py-2 border focus:ring-0 text-sm max-h-[10rem] h-28"
            placeholder="Send a message"
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            ref={chatInputRef}
          />
          <button className="flex items-center justify-center rounded-b-md block w-full py-2.5 text-sm font-bold border border-transparent theme-button-primary active:bg-[color:var(--surface-active)] focus:outline-none">
            Send{' '}
            <FontAwesomeIcon
              icon={{ prefix: 'fas', iconName: 'paper-plane' }}
              className="ml-2 inline w-4 h-4"
            />
          </button>
        </form>
      )}
    </div>
  );
};
