import { Check, Circle, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';

import type { IDashboardPanelStatus, IDashboardOverviewProps } from './DashboardOverview.types';

const greetingForCurrentTime = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const getPanelContent = (
  status: IDashboardPanelStatus,
  retryLabel: string,
  emptyLabel: string,
  content: ReactNode
): ReactNode => {
  if (status.isPending) {
    return (
      <p role="status" className="text-sm text-zinc-400">
        Loading…
      </p>
    );
  }

  if (status.isError) {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-sm text-rose-300">
          {status.error?.message || 'This dashboard data could not be loaded.'}
        </p>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-60"
          disabled={status.isFetching}
          onClick={status.onRetry}
        >
          <RotateCw
            aria-hidden="true"
            className={`size-3.5 ${status.isFetching ? 'animate-spin' : ''}`}
          />
          {status.isFetching ? 'Retrying…' : retryLabel}
        </button>
      </div>
    );
  }

  return content ?? <p className="text-sm text-zinc-500">{emptyLabel}</p>;
};

const formatSessionDate = (value: string): string => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
};

const formatScore = (score: number): string => `${score.toFixed(1)}/10`;

export const DashboardOverview = (props: IDashboardOverviewProps) => {
  const {
    name,
    summary,
    theoryStatus,
    codingStatus,
    scoreTrendStatus,
    weakAreasStatus,
    practiceTopicsStatus,
    settingsStatus,
  } = props;
  const { metrics } = summary;
  const scoreTrendLabel = summary.scoreTrend
    .map((point) => `${formatSessionDate(point.date)}: ${formatScore(point.avgScore)}`)
    .join(', ');

  const metricCards = [
    { label: 'Sessions Completed', value: metrics.completedSessions, tone: 'text-amber-300' },
    { label: 'Questions Answered', value: metrics.questionsAnswered, tone: 'text-sky-300' },
    {
      label: 'Average Score',
      value: metrics.averageScore === null ? '—' : formatScore(metrics.averageScore),
      tone: 'text-emerald-300',
    },
    { label: 'Problems Solved', value: metrics.problemsSolved, tone: 'text-violet-300' },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-h)]">
          {greetingForCurrentTime()}, {name}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {metrics.completedSessions > 0
            ? `${metrics.completedSessions} practice sessions completed. Keep building your momentum.`
            : 'Your progress will appear here as you practice.'}
        </p>
      </header>

      <section aria-label="Practice summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <article
            key={metric.label}
            className="app-shell-panel rounded-xl border border-white/10 bg-[#18181b] p-4 sm:p-5"
          >
            <p className="text-xs font-medium text-zinc-400">{metric.label}</p>
            {theoryStatus.isError && metric.label !== 'Problems Solved' ? (
              <p
                role="status"
                className="mt-2 text-2xl font-semibold text-zinc-500"
                aria-label="Unavailable"
              >
                —
              </p>
            ) : metric.label === 'Problems Solved' && codingStatus.isError ? (
              <p
                role="status"
                className="mt-2 text-2xl font-semibold text-zinc-500"
                aria-label="Unavailable"
              >
                —
              </p>
            ) : theoryStatus.isPending && metric.label !== 'Problems Solved' ? (
              <p role="status" className="mt-2 text-2xl font-semibold text-zinc-500">
                …
              </p>
            ) : metric.label === 'Problems Solved' && codingStatus.isPending ? (
              <p role="status" className="mt-2 text-2xl font-semibold text-zinc-500">
                …
              </p>
            ) : (
              <p className={`mt-2 text-2xl font-semibold tabular-nums ${metric.tone}`}>
                {metric.value}
              </p>
            )}
            {metric.label === 'Problems Solved' && codingStatus.isError && (
              <div role="alert" className="mt-2 space-y-2">
                <p className="text-xs text-rose-300">
                  {codingStatus.error?.message || 'Coding history could not be loaded.'}
                </p>
                <button
                  type="button"
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-white/10 px-2 text-xs text-zinc-200 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-60"
                  disabled={codingStatus.isFetching}
                  onClick={codingStatus.onRetry}
                >
                  <RotateCw
                    aria-hidden="true"
                    className={`size-3 ${codingStatus.isFetching ? 'animate-spin' : ''}`}
                  />
                  {codingStatus.isFetching ? 'Retrying…' : 'Retry coding history'}
                </button>
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <div className="space-y-5">
          <section className="app-shell-panel rounded-xl border border-white/10 bg-[#18181b]">
            <header className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-[var(--text-h)]">Recent Sessions</h2>
            </header>
            <div className="p-4 sm:p-5">
              {getPanelContent(
                theoryStatus,
                'Retry recent sessions',
                'No sessions yet',
                summary.recentSessions.length > 0 ? (
                  <ul className="divide-y divide-white/[0.06]">
                    {summary.recentSessions.map((session) => (
                      <li
                        key={session.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                      >
                        <span className="truncate text-sm font-medium text-zinc-200">
                          {session.topicName}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {formatSessionDate(session.startedAt)}
                        </span>
                        <span className="col-span-2 text-xs text-zinc-400 sm:col-span-1 sm:text-right">
                          {session.status === 'completed' && session.averageScore !== null
                            ? formatScore(session.averageScore)
                            : `${session.questionsAnswered}/${session.totalQuestions} answered · In progress`}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null
              )}
              {!theoryStatus.isError && !theoryStatus.isPending && practiceTopicsStatus.isError ? (
                <div role="alert" className="mt-3 space-y-2">
                  <p className="text-xs text-amber-300">
                    {practiceTopicsStatus.error?.message ||
                      'Topic names are temporarily unavailable.'}
                  </p>
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-white/10 px-2 text-xs text-zinc-200 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-60"
                    disabled={practiceTopicsStatus.isFetching}
                    onClick={practiceTopicsStatus.onRetry}
                  >
                    <RotateCw
                      aria-hidden="true"
                      className={`size-3 ${practiceTopicsStatus.isFetching ? 'animate-spin' : ''}`}
                    />
                    {practiceTopicsStatus.isFetching ? 'Retrying…' : 'Retry topic names'}
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="app-shell-panel rounded-xl border border-white/10 bg-[#18181b]">
            <header className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-[var(--text-h)]">Suggested Practice</h2>
            </header>
            <div className="p-4 sm:p-5">
              {getPanelContent(
                weakAreasStatus,
                'Retry suggestions',
                'No weak areas to work on yet',
                summary.suggestions.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {summary.suggestions.map((area) => (
                      <li
                        key={area.topicId}
                        className="rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-3 py-1.5 text-sm text-amber-200"
                      >
                        {area.topicName}
                      </li>
                    ))}
                  </ul>
                ) : null
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="app-shell-panel rounded-xl border border-white/10 bg-[#18181b] p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-[var(--text-h)]">Day Streak</h2>
            {getPanelContent(
              theoryStatus,
              'Retry streak',
              'No completed practice yet.',
              <>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-amber-300">
                  {metrics.currentStreak}
                  <span className="ml-2 text-sm font-medium text-zinc-400">days</span>
                </p>
                <div
                  className="mt-4 flex justify-between gap-2"
                  aria-label="Practice days this week"
                >
                  {summary.week.map((day) => (
                    <div key={day.date} className="flex flex-col items-center gap-1.5">
                      <span
                        aria-label={`${day.date}${day.isActive ? ', practiced' : ', no practice'}`}
                        className={`grid size-7 place-items-center rounded-full text-xs ${
                          day.isActive
                            ? 'bg-amber-400 text-zinc-950'
                            : 'border border-white/10 text-zinc-500'
                        }`}
                      >
                        {day.isActive ? (
                          <Check aria-hidden="true" className="size-3.5" />
                        ) : (
                          <Circle aria-hidden="true" className="size-1.5" />
                        )}
                      </span>
                      <span className="text-[0.65rem] text-zinc-500">{day.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="app-shell-panel rounded-xl border border-white/10 bg-[#18181b]">
            <header className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-[var(--text-h)]">Score Trend</h2>
            </header>
            <div className="p-4 sm:p-5">
              {getPanelContent(
                scoreTrendStatus,
                'Retry score trend',
                'Complete a practice session to see your scores.',
                summary.scoreTrend.length > 0 ? (
                  <div
                    role="img"
                    aria-label={`Score trend for the last ${summary.scoreTrend.length} practice days: ${scoreTrendLabel}`}
                    className="flex h-28 items-end gap-2 border-b border-white/10 px-1"
                  >
                    {summary.scoreTrend.map((point) => (
                      <div
                        key={point.date}
                        className="min-w-0 flex-1 rounded-t bg-amber-400/80"
                        style={{ height: `${Math.max(8, Math.min(100, point.avgScore * 10))}%` }}
                        title={`${formatSessionDate(point.date)} · ${formatScore(point.avgScore)}`}
                      />
                    ))}
                  </div>
                ) : null
              )}
            </div>
          </section>

          <section className="app-shell-panel rounded-xl border border-white/10 bg-[#18181b]">
            <header className="border-b border-white/[0.06] px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-[var(--text-h)]">Weak Areas</h2>
            </header>
            <div className="space-y-4 p-4 sm:p-5">
              {getPanelContent(
                weakAreasStatus,
                'Retry weak areas',
                'No weak areas to work on yet',
                summary.suggestions.length > 0 ? (
                  <ul className="space-y-4">
                    {summary.suggestions.map((area) => (
                      <li key={area.topicId}>
                        <div className="mb-1.5 flex justify-between gap-3 text-xs">
                          <span className="truncate text-zinc-300">{area.topicName}</span>
                          <span className="tabular-nums text-zinc-400">
                            {formatScore(area.avgScore)} · {area.sessionsCount} sessions
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${area.topicName} average score`}
                          aria-valuemin={0}
                          aria-valuemax={10}
                          aria-valuenow={area.avgScore}
                          className="h-1.5 overflow-hidden rounded-full bg-white/10"
                        >
                          <span
                            className="block h-full rounded-full bg-amber-400"
                            style={{ width: `${Math.max(0, Math.min(100, area.avgScore * 10))}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="app-shell-panel rounded-xl border border-white/10 bg-[#18181b] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-[var(--text-h)]">
          {summary.setupChecklist.every((item) => item.isComplete)
            ? 'Profile setup complete'
            : 'Finish setting up your profile'}
        </h2>
        <div className="mt-3">
          {getPanelContent(
            settingsStatus,
            'Retry setup checklist',
            'Setup checklist unavailable',
            <ul className="grid gap-2 sm:grid-cols-3">
              {summary.setupChecklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm text-zinc-300">
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full ${
                      item.isComplete
                        ? 'bg-emerald-400/15 text-emerald-300'
                        : 'border border-white/15 text-zinc-500'
                    }`}
                  >
                    {item.isComplete ? <Check aria-hidden="true" className="size-3" /> : null}
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
};
