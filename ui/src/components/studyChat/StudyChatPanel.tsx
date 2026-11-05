import { Maximize2, MessageSquareText, MessagesSquare, Minimize2, Plus, X } from 'lucide-react';

import { cn } from '@/utils';
import type { IStudyChatPanelProps } from './StudyChatPanel.types';

export const StudyChatPanel = (props: IStudyChatPanelProps) => {
  const {
    isOpen,
    isFullscreen,
    view,
    theme,
    children,
    onClose,
    onToggleFullscreen,
    onToggleView,
    onNewConversation,
  } = props;
  if (!isOpen) return null;

  const isDarkTheme = theme === 'dark';
  const controlClass = cn(
    'grid size-8 shrink-0 place-items-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-amber-400',
    isDarkTheme
      ? 'text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100'
      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
  );

  return (
    <section
      id="prepai-study-chat"
      role="dialog"
      aria-label="PrepAI Assistant"
      aria-modal="false"
      data-theme={theme}
      className={cn(
        'fixed z-50 flex min-h-0 flex-col overflow-hidden rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.42)]',
        isDarkTheme
          ? 'border-white/[0.1] bg-[#111113] text-zinc-100'
          : 'border-zinc-200 bg-white text-zinc-900',
        isFullscreen
          ? 'inset-x-3 top-3 bottom-24 sm:inset-x-auto sm:inset-y-8 sm:bottom-24 sm:left-1/2 sm:w-[min(900px,calc(100vw-4rem))] sm:-translate-x-1/2'
          : 'bottom-24 right-4 h-[min(520px,calc(100dvh-8rem))] w-[min(380px,calc(100vw-2rem))] sm:bottom-24 sm:right-8'
      )}
    >
      <header
        className={cn(
          'flex min-h-14 shrink-0 items-center gap-2 border-b px-3.5',
          isDarkTheme ? 'border-white/[0.08] bg-[#18181b]' : 'border-zinc-200 bg-zinc-50'
        )}
      >
        <span
          aria-hidden="true"
          className="relative grid size-8 shrink-0 place-items-center rounded-full bg-amber-300 text-zinc-950"
        >
          <MessageSquareText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              'truncate text-sm font-semibold',
              isDarkTheme ? 'text-zinc-100' : 'text-zinc-900'
            )}
          >
            PrepAI Assistant
          </h2>
          <p className={cn('text-[11px]', isDarkTheme ? 'text-zinc-500' : 'text-zinc-600')}>
            Interview & coding help
          </p>
        </div>
        <button
          type="button"
          aria-label={view === 'transcript' ? 'Conversations' : 'Back to chat'}
          className={controlClass}
          onClick={onToggleView}
        >
          {view === 'transcript' ? (
            <MessagesSquare aria-hidden="true" className="size-4" />
          ) : (
            <MessageSquareText aria-hidden="true" className="size-4" />
          )}
        </button>
        {view === 'transcript' && (
          <button
            type="button"
            aria-label="New conversation"
            className={controlClass}
            onClick={onNewConversation}
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        )}
        <button
          type="button"
          aria-label={isFullscreen ? 'Minimize chat' : 'Expand chat'}
          className={controlClass}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 aria-hidden="true" className="size-4" />
          ) : (
            <Maximize2 aria-hidden="true" className="size-4" />
          )}
        </button>
        <button type="button" aria-label="Close chat" className={controlClass} onClick={onClose}>
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
};
