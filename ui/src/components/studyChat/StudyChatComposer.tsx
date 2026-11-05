import { LoaderCircle, Send } from 'lucide-react';
import type { FormEvent } from 'react';

import { cn } from '@/utils';
import type { IStudyChatComposerProps } from './StudyChatComposer.types';

export const StudyChatComposer = (props: IStudyChatComposerProps) => {
  const {
    draft,
    isDisabled = false,
    isSending = false,
    maxLength,
    theme = 'dark',
    onDraftChange,
    onSubmit,
    placeholder = 'Ask a question…',
  } = props;
  const isDarkTheme = theme === 'dark';
  const trimmedDraft = draft.trim();
  const canSubmit = Boolean(trimmedDraft) && draft.length <= maxLength && !isDisabled && !isSending;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit) onSubmit(trimmedDraft);
  };

  return (
    <form
      aria-label="Send a message"
      className={cn(
        'flex shrink-0 items-end gap-2 border-t px-3 py-3',
        isDarkTheme ? 'border-white/[0.08] bg-[#18181b]' : 'border-zinc-200 bg-zinc-50'
      )}
      onSubmit={handleSubmit}
    >
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor="study-chat-message">
          Message PrepAI Assistant
        </label>
        <textarea
          id="study-chat-message"
          aria-describedby="study-chat-character-count"
          autoComplete="off"
          className={cn(
            'block max-h-28 min-h-10 w-full resize-y rounded-xl border bg-transparent px-3 py-2.5 text-sm leading-5 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 disabled:cursor-not-allowed disabled:opacity-60',
            isDarkTheme
              ? 'border-white/[0.1] text-zinc-100 placeholder:text-zinc-500'
              : 'border-zinc-300 text-zinc-900 placeholder:text-zinc-500'
          )}
          disabled={isDisabled || isSending}
          maxLength={maxLength}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder={placeholder}
          rows={1}
          value={draft}
        />
        <p
          id="study-chat-character-count"
          aria-live="polite"
          className={cn(
            'mt-1 px-1 text-[10px] tabular-nums',
            isDarkTheme ? 'text-zinc-500' : 'text-zinc-600'
          )}
        >
          {draft.length.toLocaleString()} / {maxLength.toLocaleString()}
        </p>
      </div>
      <button
        type="submit"
        aria-label={isSending ? 'Sending message' : 'Send message'}
        disabled={!canSubmit}
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-xl bg-amber-300 text-zinc-950 transition hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed',
          isDarkTheme
            ? 'disabled:bg-zinc-700 disabled:text-zinc-400'
            : 'disabled:bg-zinc-200 disabled:text-zinc-600'
        )}
      >
        {isSending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Send aria-hidden="true" className="size-4" />
        )}
      </button>
    </form>
  );
};
