import { LoaderCircle, MessageSquareText, Plus, RotateCw, Trash2 } from 'lucide-react';

import { cn } from '@/utils';
import type { IStudyChatConversationListProps } from './StudyChatConversationList.types';

export const StudyChatConversationList = (props: IStudyChatConversationListProps) => {
  const {
    conversations,
    selectedConversationId,
    isLoading = false,
    isLoadingMore,
    hasMore,
    errorMessage,
    theme = 'dark',
    onSelect,
    onDelete,
    onLoadMore,
    onNewConversation,
    onRetry,
  } = props;
  const isDarkTheme = theme === 'dark';

  if (isLoading) {
    return (
      <p role="status" className="m-auto flex items-center gap-2 py-8 text-sm text-zinc-500">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-amber-500" />
        Loading conversations…
      </p>
    );
  }

  if (errorMessage) {
    return (
      <div role="alert" className="m-auto max-w-xs p-5 text-center">
        <p className={cn('text-sm leading-5', isDarkTheme ? 'text-rose-300' : 'text-rose-700')}>
          {errorMessage}
        </p>
        {onRetry && (
          <button
            type="button"
            className={cn(
              'mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-amber-400',
              isDarkTheme
                ? 'border-white/10 text-zinc-200 hover:bg-white/[0.06]'
                : 'border-zinc-300 text-zinc-800 hover:bg-zinc-100'
            )}
            onClick={onRetry}
          >
            <RotateCw aria-hidden="true" className="size-3.5" /> Retry conversations
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <div>
          <h3
            className={cn('text-sm font-semibold', isDarkTheme ? 'text-zinc-100' : 'text-zinc-900')}
          >
            Your conversations
          </h3>
          <p className={cn('mt-0.5 text-xs', isDarkTheme ? 'text-zinc-500' : 'text-zinc-600')}>
            Pick up where you left off.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-amber-300 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          onClick={onNewConversation}
        >
          <Plus aria-hidden="true" className="size-3.5" /> New
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="m-auto px-6 py-8 text-center">
          <MessageSquareText aria-hidden="true" className="mx-auto size-6 text-amber-500" />
          <p
            className={cn(
              'mt-3 text-sm font-medium',
              isDarkTheme ? 'text-zinc-200' : 'text-zinc-800'
            )}
          >
            No conversations yet
          </p>
          <p className={cn('mt-1 text-xs', isDarkTheme ? 'text-zinc-500' : 'text-zinc-600')}>
            Start a chat and it will be saved here.
          </p>
        </div>
      ) : (
        <ul
          aria-label="Saved conversations"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2"
        >
          {conversations.map((conversation) => {
            const isSelected = conversation.id === selectedConversationId;
            return (
              <li key={conversation.id} className="group flex items-center gap-1 rounded-xl">
                <button
                  type="button"
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'min-h-12 min-w-0 flex-1 rounded-xl px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-amber-400',
                    isSelected
                      ? isDarkTheme
                        ? 'bg-white/[0.08]'
                        : 'bg-zinc-100'
                      : isDarkTheme
                        ? 'hover:bg-white/[0.04]'
                        : 'hover:bg-zinc-50'
                  )}
                  onClick={() => onSelect(conversation.id)}
                >
                  <span
                    className={cn(
                      'block truncate text-sm font-medium',
                      isDarkTheme ? 'text-zinc-200' : 'text-zinc-800'
                    )}
                  >
                    {conversation.title}
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 block text-[11px]',
                      isDarkTheme ? 'text-zinc-500' : 'text-zinc-600'
                    )}
                  >
                    {conversation.turnCount} {conversation.turnCount === 1 ? 'turn' : 'turns'}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${conversation.title}`}
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-lg opacity-70 transition hover:text-rose-500 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-amber-400 sm:opacity-0 sm:group-hover:opacity-100',
                    isDarkTheme
                      ? 'text-zinc-500 hover:bg-rose-400/10'
                      : 'text-zinc-500 hover:bg-rose-50'
                  )}
                  onClick={() => onDelete(conversation)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div
          className={cn(
            'shrink-0 border-t p-3',
            isDarkTheme ? 'border-white/[0.08]' : 'border-zinc-200'
          )}
        >
          <button
            type="button"
            disabled={isLoadingMore}
            className={cn(
              'flex min-h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-wait disabled:opacity-60',
              isDarkTheme
                ? 'text-zinc-300 hover:bg-white/[0.05]'
                : 'text-zinc-700 hover:bg-zinc-100'
            )}
            onClick={onLoadMore}
          >
            {isLoadingMore && <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />}
            {isLoadingMore ? 'Loading conversations' : 'Load more conversations'}
          </button>
        </div>
      )}
    </div>
  );
};
