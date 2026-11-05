import { LoaderCircle } from 'lucide-react';

import type { ICodingStatsBarProps } from './CodingStatsBar.types';

export const CodingStatsBar = (props: ICodingStatsBarProps) => {
  const { stats, isLoading, isRetrying, errorMessage, onRetry } = props;

  if (isLoading && !stats) {
    return (
      <div
        role="status"
        className="flex min-h-24 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-[#141416] text-sm text-zinc-400"
      >
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-amber-400" />
        Loading coding stats
      </div>
    );
  }

  if (!stats) {
    if (!errorMessage) return null;
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.05] px-4 py-3"
      >
        <p className="min-w-0 text-sm text-rose-200">{errorMessage}</p>
        <button
          type="button"
          disabled={isRetrying}
          onClick={onRetry}
          className="min-h-9 shrink-0 rounded-lg border border-rose-300/25 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-wait disabled:opacity-60"
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
    { label: 'Day Streak', value: `${stats.streakDays} days` },
  ];

  return (
    <section aria-label="Coding statistics" className="space-y-2">
      {errorMessage && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-400/20 bg-rose-400/[0.05] px-3 py-2"
        >
          <p className="min-w-0 text-xs text-rose-200">{errorMessage}</p>
          <button
            type="button"
            disabled={isRetrying}
            onClick={onRetry}
            className="min-h-8 shrink-0 px-2 text-xs font-semibold text-rose-100 underline decoration-rose-200/50 underline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-60"
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      )}
      <dl
        role="group"
        aria-label="Coding statistics"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.08] md:grid-cols-4"
      >
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex min-w-0 flex-col bg-[#141416] px-4 py-3 sm:px-5 sm:py-3.5"
          >
            <dt className="order-2 mt-1 text-[11px] font-medium text-zinc-400">{metric.label}</dt>
            <dd className="order-1 font-mono text-xl font-semibold tabular-nums leading-6 text-amber-300">
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
