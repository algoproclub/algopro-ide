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
      <div className="font-bold text-sm text-white py-2.5 px-4 rounded-t-md border border-gray-700 bg-gray-800">
        Chat
      </div>
      <div
        className="flex-1 space-y-1 min-h-0 overflow-y-auto border-gray-700 border border-t-0 p-2 bg-gray-900"
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
            <p className="text-gray-400 text-sm">No chat messages.</p>
          ))}
      </div>
      {(userPermission === 'OWNER' || userPermission === 'READ_WRITE') && (
        <form onSubmit={handleSubmit}>
          <textarea
            className="mt-2 text-white block w-full bg-[#121212] px-3 py-2 border border-gray-700 focus:border-gray-600 focus:ring-0 focus:placeholder-gray-400 text-sm max-h-[10rem] h-28"
            placeholder="Send a message"
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            ref={chatInputRef}
          />
          <button className="rounded-b-md block w-full py-2.5 text-sm font-bold text-indigo-100 hover:text-indigo-100 border border-0 border-gray-600 bg-gray-700 hover:bg-gray-600 active:bg-[#5b5b5b] focus:outline-none">
            Send{' '}
            <FontAwesomeIcon
              icon={{ prefix: 'fas', iconName: 'paper-plane' }}
              className="ml-1"
            />
          </button>
        </form>
      )}
    </div>
  );
};
