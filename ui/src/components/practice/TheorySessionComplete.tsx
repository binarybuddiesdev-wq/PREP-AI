import { PartyPopper } from 'lucide-react';

import type { ITheorySessionCompleteProps } from './TheorySessionComplete.types';

export const TheorySessionComplete = (props: ITheorySessionCompleteProps) => {
  const { session, answers, onPracticeAgain, onGoToDashboard } = props;
  const scoredAnswers = answers.filter((answer) => answer.aiScore !== null);
  const failedAnswers = answers.filter((answer) => answer.status === 'failed');
  const elapsedMinutes = session.completedAt
    ? Math.round((Date.parse(session.completedAt) - Date.parse(session.startedAt)) / 60_000)
    : Number.NaN;
  const duration =
    Number.isFinite(elapsedMinutes) && elapsedMinutes >= 0 ? `${elapsedMinutes}m` : '—';

  return (
    <main className="mx-auto w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-[var(--accent-bg)] text-[var(--accent-strong)]">
          <PartyPopper aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mb-1 text-2xl font-semibold text-[var(--text-h)]">Session Complete!</h1>
        <p className="text-sm text-[var(--dim)]">Great work! Here&apos;s how you did.</p>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <dt className="text-xs text-[var(--dim)]">Questions</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--accent-strong)]">
            {session.questionsAnswered}
          </dd>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <dt className="text-xs text-[var(--dim)]">Avg Score</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--accent-strong)]">
            {scoredAnswers.length > 0 ? session.avgScore.toFixed(1) : 'No scored answers'}
          </dd>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <dt className="text-xs text-[var(--dim)]">Time</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--accent-strong)]">
            {duration}
          </dd>
        </div>
      </dl>

      {failedAnswers.length > 0 ? (
        <p className="mt-3 text-center text-xs text-[var(--dim)]">
          {failedAnswers.length} {failedAnswers.length === 1 ? 'answer could' : 'answers could'} not
          be scored.
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={onPracticeAgain}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Back to Practice
        </button>
        <button
          type="button"
          onClick={onGoToDashboard}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[var(--border2)] px-5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Go to Dashboard
        </button>
      </div>
    </main>
  );
};
