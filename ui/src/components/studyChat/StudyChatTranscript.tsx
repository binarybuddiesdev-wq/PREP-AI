import { Bot, LoaderCircle, RotateCw, X } from 'lucide-react';

import { StudyChatMessage } from './StudyChatMessage';
import type { IStudyChatTranscriptProps } from './StudyChatTranscript.types';

export const StudyChatTranscript = (props: IStudyChatTranscriptProps) => {
  const {
    messages,
    theme = 'dark',
    isLoading = false,
    isSending = false,
    errorMessage,
    sendErrorMessage,
    isTurnLimitReached = false,
    onRetry,
    onBackToList,
    onRetrySend,
    onDismissSendError,
    onNewConversation,
  } = props;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
        className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'}`}
      >
        {isLoading ? (
          <p
            role="status"
            className={`m-auto flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-600'}`}
          >
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-amber-500" />
            Loading conversation…
          </p>
        ) : errorMessage ? (
          <div role="alert" className="m-auto max-w-xs text-center">
            <p
              className={`text-sm leading-5 ${theme === 'dark' ? 'text-rose-300' : 'text-rose-700'}`}
            >
              {errorMessage}
            </p>
            {onRetry && (
              <button
                type="button"
                className={`mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-amber-400 ${theme === 'dark' ? 'border-white/10 text-zinc-200 hover:bg-white/[0.06]' : 'border-zinc-300 text-zinc-800 hover:bg-zinc-100'}`}
                onClick={onRetry}
              >
                <RotateCw aria-hidden="true" className="size-3.5" />
                Retry loading conversation
              </button>
            )}
            {onBackToList && (
              <button
                type="button"
                className={`mt-2 inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-amber-400 ${theme === 'dark' ? 'text-zinc-300 hover:bg-white/[0.06]' : 'text-zinc-700 hover:bg-zinc-100'}`}
                onClick={onBackToList}
              >
                Back to conversations
              </button>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div
            className={`mr-auto max-w-[85%] rounded-xl rounded-bl-[4px] border px-4 py-3 text-[0.85rem] leading-[1.5] ${theme === 'dark' ? 'border-white/[0.08] bg-white/[0.04] text-zinc-300' : 'border-black/[0.06] bg-black/[0.03] text-zinc-700'}`}
          >
            Hi! I&apos;m PrepAI&apos;s assistant. Ask me anything about coding, interview prep, or
            how to use the platform.
          </div>
        ) : (
          messages.map((message, index) => (
            <StudyChatMessage
              key={`${message.createdAt}-${index}`}
              message={message}
              theme={theme}
            />
          ))
        )}
        {!isLoading && !errorMessage && isSending && (
          <p
            role="status"
            className={`mr-auto flex items-center gap-2 px-1 text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}
          >
            <Bot aria-hidden="true" className="size-4 text-amber-400" />
            PrepAI is thinking…
          </p>
        )}
      </div>
      {sendErrorMessage && (
        <div
          role="alert"
          className={`flex shrink-0 items-start justify-between gap-3 border-t px-4 py-3 ${theme === 'dark' ? 'border-rose-400/15 bg-rose-400/[0.06]' : 'border-rose-200 bg-rose-50'}`}
        >
          <p
            className={`text-xs leading-5 ${theme === 'dark' ? 'text-rose-200' : 'text-rose-800'}`}
          >
            {sendErrorMessage}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {onRetrySend && (
              <button
                type="button"
                className={`min-h-8 rounded-md px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-amber-400 ${theme === 'dark' ? 'text-zinc-100 hover:bg-white/[0.08]' : 'text-zinc-800 hover:bg-rose-100'}`}
                onClick={onRetrySend}
              >
                Retry message
              </button>
            )}
            {onDismissSendError && (
              <button
                type="button"
                aria-label="Dismiss send error"
                className={`grid size-8 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-amber-400 ${theme === 'dark' ? 'text-zinc-400 hover:bg-white/[0.08]' : 'text-zinc-600 hover:bg-rose-100'}`}
                onClick={onDismissSendError}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
        </div>
      )}
      {isTurnLimitReached && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-amber-300/15 bg-amber-300/[0.05] px-4 py-3">
          <p
            className={`text-xs leading-5 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-800'}`}
          >
            This conversation reached its 30-turn limit.
          </p>
          {onNewConversation && (
            <button
              type="button"
              className="min-h-9 shrink-0 rounded-lg bg-amber-300 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              onClick={onNewConversation}
            >
              Start a new conversation
            </button>
          )}
        </div>
      )}
    </div>
  );
};
