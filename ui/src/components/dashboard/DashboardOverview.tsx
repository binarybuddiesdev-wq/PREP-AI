import { BookOpenCheck, Check, CircleHelp, Code2, RotateCw, Star, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';

import { ROUTES } from '@/core';
import { getApiErrorMessage } from '@/utils/apiErrorMessage';
import { DashboardPracticeCoding } from './DashboardPracticeCoding';
import { ScoreTrendChart } from './ScoreTrendChart';
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
      <p role="status" className="text-sm text-[var(--dim)]">
        Loading…
      </p>
    );
  }

  if (status.isError) {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-sm text-[var(--danger-strong)]">
          {status.error
            ? getApiErrorMessage(
                status.error,
                `load ${retryLabel.toLowerCase().replace(/^retry /, '')}`
              )
            : 'This dashboard data could not be loaded.'}
        </p>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
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

  return content ?? <p className="text-sm text-[var(--dim)]">{emptyLabel}</p>;
};

const formatSessionDate = (value: string): string => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
};

const formatScore = (score: number): string => score.toFixed(1);
const formatScorePercent = (score: number): string => `${Math.round(score * 10)}%`;

export const DashboardOverview = (props: IDashboardOverviewProps) => {
  const {
    name,
    summary,
    practiceTopics,
    codingProblems,
    theoryStatus,
    codingStatus,
    codingProblemsStatus,
    scoreTrendStatus,
    weakAreasStatus,
    practiceTopicsStatus,
    settingsStatus,
    onOpenSession,
  } = props;
  const { metrics } = summary;
  const [isSetupBannerDismissed, setIsSetupBannerDismissed] = useState(false);
  const shouldShowSetupBanner =
    !isSetupBannerDismissed &&
    (settingsStatus.isPending ||
      settingsStatus.isError ||
      summary.setupChecklist.some((item) => !item.isComplete));

  const metricCards = [
    {
      label: 'Sessions Completed',
      value: metrics.completedSessions,
      tone: 'text-[var(--accent-strong)]',
      iconTone: 'bg-[var(--accent-bg)] text-[var(--accent-strong)]',
      icon: BookOpenCheck,
    },
    {
      label: 'Questions Answered',
      value: metrics.questionsAnswered,
      tone: 'text-[var(--info-strong)]',
      iconTone: 'bg-[var(--blue-bg)] text-[var(--info-strong)]',
      icon: CircleHelp,
    },
    {
      label: 'Average Score',
      value: metrics.averageScore === null ? '—' : formatScore(metrics.averageScore),
      tone: 'text-[var(--success-strong)]',
      iconTone: 'bg-[var(--green-bg)] text-[var(--success-strong)]',
      icon: Star,
    },
    {
      label: 'Problems Solved',
      value: metrics.problemsSolved,
      tone: 'text-[var(--purple-strong)]',
      iconTone: 'bg-[var(--purple-bg)] text-[var(--purple-strong)]',
      icon: Code2,
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 pt-1 max-[480px]:-mt-2 max-[480px]:pt-0">
      {shouldShowSetupBanner && (
        <section
          aria-label="Complete your setup"
          className="relative rounded-[14px] border border-[rgba(245,158,11,0.18)] bg-[linear-gradient(135deg,rgba(245,158,11,0.06),rgba(139,92,246,0.04))] p-5"
        >
          <button
            type="button"
            aria-label="Dismiss setup checklist"
            onClick={() => setIsSetupBannerDismissed(true)}
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-md text-[var(--faint)] transition hover:bg-[var(--surface)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
          <h2 className="mb-3 pr-10 text-base font-semibold text-[var(--text-h)]">
            Welcome to PrepAI {String.fromCodePoint(0x1f44b)} Complete your setup to personalize
            your practice
          </h2>
          {getPanelContent(
            settingsStatus,
            'Retry setup checklist',
            'Setup checklist unavailable',
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {summary.setupChecklist.map((item) => (
                <li
                  key={item.label}
                  className={`flex items-center gap-2 text-[0.825rem] ${item.isComplete ? 'text-[var(--success-strong)]' : 'text-[var(--dim)]'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-5 shrink-0 place-items-center rounded-full text-[0.65rem] font-bold ${
                      item.isComplete
                        ? 'bg-[var(--green-bg)] text-[var(--success-strong)]'
                        : 'border border-[var(--border2)] text-[var(--faint)]'
                    }`}
                  >
                    {item.isComplete ? <Check className="size-3" /> : '•'}
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <header className="mb-[2px] max-[480px]:mb-[-2px]">
        <h1 className="m-0 text-[1.35rem] font-bold text-[var(--text-h)]">
          {greetingForCurrentTime()}, {name} {String.fromCodePoint(0x1f44b)}
        </h1>
        <p className="!mt-1 text-sm text-[var(--dim)] max-[480px]:!mt-2">
          {metrics.completedSessions > 0
            ? `${metrics.completedSessions} sessions completed. Keep it up.`
            : 'Your progress will appear as you practice.'}
        </p>
      </header>

      <section
        aria-label="Practice summary"
        className="mb-1 grid grid-cols-4 gap-4 max-[480px]:grid-cols-1"
      >
        {metricCards.map((metric) => (
          <article
            key={metric.label}
            className="app-shell-panel min-h-[153px] rounded-xl border border-[var(--border)] bg-[var(--card)] px-[1.4rem] py-[1.2rem]"
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                aria-hidden="true"
                className={`grid size-[38px] place-items-center rounded-lg ${metric.iconTone}`}
              >
                <metric.icon className="size-[18px]" />
              </span>
            </div>
            {theoryStatus.isError && metric.label !== 'Problems Solved' ? (
              <p
                role="status"
                className="mt-2 text-[1.7rem] font-bold text-[var(--dim)]"
                aria-label="Unavailable"
              >
                —
              </p>
            ) : metric.label === 'Problems Solved' && codingStatus.isError ? (
              <p
                role="status"
                className="mt-2 text-[1.7rem] font-bold text-[var(--dim)]"
                aria-label="Unavailable"
              >
                —
              </p>
            ) : theoryStatus.isPending && metric.label !== 'Problems Solved' ? (
              <p role="status" className="mt-2 text-[1.7rem] font-bold text-[var(--dim)]">
                …
              </p>
            ) : metric.label === 'Problems Solved' && codingStatus.isPending ? (
              <p role="status" className="mt-2 text-[1.7rem] font-bold text-[var(--dim)]">
                …
              </p>
            ) : (
              <p className={`mt-2 text-[1.7rem] font-bold tabular-nums ${metric.tone}`}>
                {metric.value}
              </p>
            )}
            <p className="mt-0.5 text-[0.78rem] font-medium text-[var(--dim)]">{metric.label}</p>
            {metric.label === 'Problems Solved' && codingStatus.isError && (
              <div role="alert" className="mt-2 space-y-2">
                <p className="text-xs text-[var(--danger-strong)]">
                  {codingStatus.error?.message || 'Coding history could not be loaded.'}
                </p>
                <button
                  type="button"
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--border2)] px-2 text-xs text-[var(--text)] hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
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
          <section className="app-shell-panel rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-[var(--text-h)]">Recent Sessions</h2>
              <Link
                to={ROUTES.history}
                className="inline-flex min-h-9 shrink-0 items-center rounded-md px-2 text-xs font-medium text-[var(--dim)] transition hover:bg-[var(--surface)] hover:text-[var(--text-h)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                View all sessions
              </Link>
            </header>
            <div className="p-4 sm:p-5">
              {getPanelContent(
                theoryStatus,
                'Retry recent sessions',
                'No sessions yet',
                summary.recentSessions.length > 0 ? (
                  <table
                    aria-label="Recent Sessions"
                    className="w-full table-fixed border-collapse text-left"
                  >
                    <colgroup>
                      <col className="w-[32%]" />
                      <col className="w-[19%]" />
                      <col className="w-[21%]" />
                      <col className="w-[28%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[0.65rem] font-medium text-[var(--dim)] sm:text-xs">
                        <th scope="col" className="px-1.5 pb-2 text-left sm:px-2">
                          Topic
                        </th>
                        <th scope="col" className="px-1.5 pb-2 text-left sm:px-2">
                          Date
                        </th>
                        <th scope="col" className="px-1.5 pb-2 text-left sm:px-2">
                          Score
                        </th>
                        <th scope="col" className="px-1.5 pb-2 text-left sm:px-2">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {summary.recentSessions.map((session) => (
                        <tr key={session.id}>
                          <td className="py-1 pr-1.5 sm:pr-2">
                            <button
                              type="button"
                              aria-label={`View ${session.topicName} session`}
                              onClick={() => onOpenSession(session.id)}
                              className="min-h-11 w-full truncate rounded-sm text-left text-xs font-medium text-[var(--text)] transition hover:text-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:px-2 sm:text-sm"
                            >
                              {session.topicName}
                            </button>
                          </td>
                          <td className="truncate px-1.5 py-1 text-[0.65rem] text-[var(--dim)] sm:px-2 sm:text-xs">
                            {formatSessionDate(session.startedAt)}
                          </td>
                          <td className="truncate px-1.5 py-1 text-[0.65rem] tabular-nums sm:px-2 sm:text-xs">
                            {session.averageScore === null ? (
                              <span className="text-[var(--dim)]">—</span>
                            ) : (
                              <span
                                aria-label={`Score: ${formatScore(session.averageScore)} out of 10`}
                                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-[0.6rem] font-medium leading-none sm:px-2 sm:text-[0.7rem] ${
                                  session.averageScore >= 7
                                    ? 'bg-[var(--green-bg)] text-[var(--success-strong)]'
                                    : session.averageScore >= 5
                                      ? 'bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                                      : 'bg-[var(--red-bg)] text-[var(--danger-strong)]'
                                }`}
                              >
                                {session.averageScore >= 7 ? (
                                  <Check aria-hidden="true" className="size-3" />
                                ) : session.averageScore >= 5 ? (
                                  <span aria-hidden="true">~</span>
                                ) : (
                                  <span aria-hidden="true">!</span>
                                )}
                                {formatScore(session.averageScore)}
                              </span>
                            )}
                          </td>
                          <td className="px-1.5 py-1 sm:px-2">
                            <span
                              className={`inline-flex max-w-full truncate rounded-full px-1.5 py-1 text-[0.6rem] font-medium leading-none sm:px-2 sm:text-[0.7rem] ${
                                session.status === 'completed'
                                  ? 'bg-[var(--green-bg)] text-[var(--success-strong)]'
                                  : 'bg-[var(--blue-bg)] text-[var(--info-strong)]'
                              }`}
                            >
                              {session.status === 'completed' ? 'Completed' : 'In progress'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null
              )}
            </div>
          </section>

          <section className="app-shell-panel rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <header className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-[var(--text-h)]">Suggested Practice</h2>
            </header>
            <div className="p-4 sm:p-5">
              {getPanelContent(
                weakAreasStatus,
                'Retry suggestions',
                'No weak areas to work on yet',
                summary.suggestions.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs leading-5 text-[var(--dim)]">
                      Based on your weak areas, we recommend:
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {summary.suggestions.map((area) => (
                        <li key={area.topicId}>
                          <Link
                            to={`${ROUTES.practice}?topicId=${encodeURIComponent(area.topicId)}`}
                            className="inline-flex min-h-8 items-center rounded-full border border-[var(--border2)] bg-[var(--surface)] px-3 py-1 text-[0.78rem] text-[var(--dim)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-bg)] hover:text-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                          >
                            Practice {area.topicName}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              )}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="app-shell-panel rounded-xl border border-[var(--border)] bg-[var(--card)] p-7 text-center">
            {getPanelContent(
              theoryStatus,
              'Retry streak',
              'No completed practice yet.',
              <>
                <p className="m-0 text-[2.8rem] font-bold leading-none tabular-nums text-[var(--accent-strong)]">
                  {metrics.currentStreak}
                </p>
                <h2 className="mb-4 mt-1 text-[0.825rem] font-normal text-[var(--dim)]">
                  Day Streak
                </h2>
                <div
                  className="flex justify-center gap-[0.4rem]"
                  aria-label="Practice days this week"
                >
                  {summary.week.map((day) => (
                    <div key={day.date} className="flex flex-col items-center">
                      <span
                        aria-label={`${day.date}${day.isActive ? ', practiced' : ', no practice'}`}
                        className={`grid size-[34px] place-items-center rounded-full border text-[0.65rem] font-semibold ${
                          day.isActive
                            ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--dim)]'
                        }`}
                      >
                        {day.isActive ? day.label : day.label}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="app-shell-panel rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-[var(--text-h)]">Score Trend</h2>
              {!scoreTrendStatus.isError && summary.scoreTrend.length > 0 && (
                <span className="text-xs text-[var(--dim)]">
                  Last {summary.scoreTrend.length} session
                  {summary.scoreTrend.length === 1 ? '' : 's'}
                </span>
              )}
            </header>
            <div className="p-4 sm:p-5">
              {getPanelContent(
                scoreTrendStatus,
                'Retry score trend',
                'Complete a practice session to see your scores.',
                summary.scoreTrend.length > 0 ? (
                  <ScoreTrendChart points={summary.scoreTrend} />
                ) : null
              )}
            </div>
          </section>

          <section className="app-shell-panel rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <header className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
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
                          <span className="truncate text-[var(--text)]">{area.topicName}</span>
                          <span className="tabular-nums text-[var(--dim)]">
                            {formatScorePercent(area.avgScore)} · {area.sessionsCount} sessions
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${area.topicName} average score`}
                          aria-valuemin={0}
                          aria-valuemax={10}
                          aria-valuenow={area.avgScore}
                          className="h-1.5 overflow-hidden rounded-full bg-[var(--surface2)]"
                        >
                          <span
                            className="block h-full rounded-full bg-[var(--accent)]"
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

      <DashboardPracticeCoding
        practiceTopics={practiceTopics}
        practiceTopicsStatus={practiceTopicsStatus}
        codingProblems={codingProblems}
        codingProblemsStatus={codingProblemsStatus}
      />
    </main>
  );
};
