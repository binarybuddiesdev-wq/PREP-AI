import { LoaderCircle } from 'lucide-react';

import type { ICodingStatsBarProps } from './CodingStatsBar.types';

export const CodingStatsBar = (props: ICodingStatsBarProps) => {
  const { stats, isLoading, isRetrying, errorMessage, onRetry } = props;

  if (isLoading && !stats) {
    return (
      <div
        role="status"
        className="flex min-h-24 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--dim)]"
      >
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin text-[var(--accent-strong)]"
        />
        Loading coding stats
      </div>
    );
  }

  if (!stats) {
    if (!errorMessage) return null;
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--red-bg)] bg-[var(--red-bg)] px-4 py-3"
      >
        <p className="min-w-0 text-sm text-[var(--danger-strong)]">{errorMessage}</p>
        <button
          type="button"
          disabled={isRetrying}
          onClick={onRetry}
          className="min-h-9 shrink-0 rounded-lg border border-[var(--red-bg)] px-3 text-xs font-semibold text-[var(--danger-strong)] transition hover:bg-[var(--red-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
        >
          {isRetrying ? 'Retrying...' : 'Retry coding stats'}
        </button>
      </div>
    );
  }

  const metrics = [
    { label: 'Solved', value: String(stats.solved) },
    { label: 'Today', value: `${stats.dailySolved.used} / ${stats.dailySolved.limit}` },
    { label: 'AI Reviews', value: `${stats.dailyReviews.used} / ${stats.dailyReviews.limit}` },
    { label: 'Day Streak', value: String(stats.streakDays) },
  ];

  return (
    <section aria-label="Coding statistics" className="space-y-2">
      {errorMessage && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--red-bg)] bg-[var(--red-bg)] px-3 py-2"
        >
          <p className="min-w-0 text-xs text-[var(--danger-strong)]">{errorMessage}</p>
          <button
            type="button"
            disabled={isRetrying}
            onClick={onRetry}
            className="min-h-8 shrink-0 px-2 text-xs font-semibold text-[var(--danger-strong)] underline decoration-[var(--danger-strong)] underline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      )}
      <dl
        role="group"
        aria-label="Coding statistics"
        className="mb-5 flex flex-wrap items-center gap-6 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3.5"
      >
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-[4rem] text-center">
            <dd className="mb-[0.15rem] font-mono text-[1.3rem] font-bold leading-none text-[var(--text)]">
              {metric.value}
            </dd>
            <dt className="text-[0.72rem] text-[var(--dim)]">{metric.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
};
