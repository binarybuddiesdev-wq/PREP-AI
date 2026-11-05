import { Bot, UserRound } from 'lucide-react';

import type { IStudyChatMessageProps } from './StudyChatMessage.types';

export const StudyChatMessage = ({ message, theme = 'dark' }: IStudyChatMessageProps) => {
  const isUser = message.role === 'user';
  const isDarkTheme = theme === 'dark';

  return (
    <article
      aria-label={isUser ? 'Your message' : 'PrepAI Assistant message'}
      className={`flex max-w-[92%] flex-col gap-1.5 ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}
    >
      <span
        className={`flex items-center gap-1.5 px-1 text-[11px] font-medium ${isDarkTheme ? 'text-zinc-500' : 'text-zinc-600'}`}
      >
        {isUser ? (
          <UserRound aria-hidden="true" className="size-3.5" />
        ) : (
          <Bot aria-hidden="true" className="size-3.5 text-amber-500" />
        )}
        {isUser ? 'You' : 'PrepAI Assistant'}
      </span>
      <p
        className={`max-w-full break-words rounded-2xl px-3.5 py-2.5 text-sm leading-5 whitespace-pre-wrap ${
          isUser
            ? 'rounded-br-md bg-amber-300 text-zinc-950'
            : isDarkTheme
              ? 'rounded-bl-md border border-white/[0.07] bg-white/[0.04] text-zinc-200'
              : 'rounded-bl-md border border-zinc-200 bg-zinc-100 text-zinc-800'
        }`}
      >
        {message.content}
      </p>
      <time
        dateTime={message.createdAt}
        className={`px-1 text-[10px] ${isDarkTheme ? 'text-zinc-500' : 'text-zinc-600'}`}
      >
        {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
          new Date(message.createdAt)
        )}
      </time>
    </article>
  );
};
