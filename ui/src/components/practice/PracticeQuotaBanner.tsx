import { LoaderCircle, RotateCw, Zap } from 'lucide-react';

import type { IPracticeQuotaBannerProps } from './PracticeQuotaBanner.types';

export const PracticeQuotaBanner = (props: IPracticeQuotaBannerProps) => {
  const { dailySessions, isLoading, isRetrying, errorMessage, onRetry } = props;

  if (isLoading) {
    return (
      <div
        role="status"
        className="flex min-h-11 items-center gap-2.5 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-bg)] px-4 py-2.5"
      >
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-[var(--accent)]" />
        <p className="text-sm text-[var(--dim)]">Loading today&apos;s practice usage...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-xl border border-[var(--red-bg)] bg-[var(--red-bg)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-h)]">Practice usage unavailable</p>
          <p className="mt-0.5 break-words text-xs leading-5 text-[var(--danger-strong)]">
            {errorMessage}
          </p>
        </div>
        {onRetry ? (
          <button
            type="button"
            disabled={isRetrying}
            onClick={onRetry}
            className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-60 sm:self-center"
          >
            <RotateCw
              aria-hidden="true"
              className={`size-3.5 ${isRetrying ? 'animate-spin' : ''}`}
            />
            {isRetrying ? 'Retrying usage' : 'Retry usage'}
          </button>
        ) : null}
      </div>
    );
  }

  if (!dailySessions) return null;

  const remaining = Math.max(0, dailySessions.limit - dailySessions.used);
  const isLimitReached = remaining === 0;

  return (
    <div
      role="status"
      className={`flex min-h-11 items-center gap-2.5 rounded-xl border px-4 py-2.5 ${isLimitReached ? 'border-[var(--red-bg)] bg-[var(--red-bg)]' : 'border-[var(--accent-border)] bg-[var(--accent-bg)]'}`}
    >
      <Zap
        aria-hidden="true"
        className={`size-4 shrink-0 ${isLimitReached ? 'text-[var(--danger-strong)]' : 'text-[var(--accent-strong)]'}`}
      />
      <p className="text-sm text-[var(--dim)]">
        {isLimitReached ? (
          <>
            <span className="font-semibold text-[var(--text-h)]">
              Daily practice limit reached.
            </span>{' '}
            Try again tomorrow.
          </>
        ) : (
          <>
            <span className="font-semibold text-[var(--accent-strong)]">
              {remaining} of {dailySessions.limit} sessions
            </span>{' '}
            left today
          </>
        )}
      </p>
    </div>
  );
};
