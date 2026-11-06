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
    <main className="mx-auto w-full pt-1">
      <h1 className="mb-4 mt-0 text-[1.35rem] font-bold text-[var(--text-h)]">Practice Session</h1>
      <section
        aria-labelledby="theory-session-complete-title"
        className="mx-auto mb-8 mt-12 w-full max-w-[30rem] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center sm:p-10"
      >
        <span aria-hidden="true" className="mb-4 block text-5xl leading-[1.6]">
          {String.fromCodePoint(0x1f389)}
        </span>
        <h2
          id="theory-session-complete-title"
          className="m-0 mb-1 text-[1.3rem] leading-[1.6] font-bold text-[var(--text-h)]"
        >
          Session Complete!
        </h2>
        <p className="mb-6 text-[0.9rem] text-[var(--dim)]">Great work! Here&apos;s how you did.</p>

        <dl className="mb-8 mt-6 flex justify-center gap-8">
          <div className="flex min-w-0 flex-1 flex-col text-center">
            <dt className="order-2 text-[0.78rem] text-[var(--dim)]">Questions</dt>
            <dd className="order-1 mb-0.5 font-mono text-[1.8rem] leading-none font-bold tabular-nums text-[var(--accent-strong)]">
              {session.questionsAnswered}
            </dd>
          </div>
          <div className="flex min-w-0 flex-1 flex-col text-center">
            <dt className="order-2 text-[0.78rem] text-[var(--dim)]">Avg Score</dt>
            <dd
              className={`order-1 mb-0.5 break-words font-mono font-bold tabular-nums text-[var(--accent-strong)] ${
                scoredAnswers.length > 0 ? 'text-[1.8rem] leading-none' : 'text-xs leading-4'
              }`}
            >
              {scoredAnswers.length > 0 ? session.avgScore.toFixed(1) : 'No scored answers'}
            </dd>
          </div>
          <div className="flex min-w-0 flex-1 flex-col text-center">
            <dt className="order-2 text-[0.78rem] text-[var(--dim)]">Time</dt>
            <dd className="order-1 mb-0.5 font-mono text-[1.8rem] leading-none font-bold tabular-nums text-[var(--accent-strong)]">
              {duration}
            </dd>
          </div>
        </dl>

        {failedAnswers.length > 0 ? (
          <p className="mb-3 text-center text-xs text-[var(--dim)]">
            {`${failedAnswers.length} ${failedAnswers.length === 1 ? 'answer could' : 'answers could'} not be scored.`}
          </p>
        ) : null}
        <div className="flex flex-col gap-[0.6rem]">
          <button
            type="button"
            onClick={onPracticeAgain}
            className="inline-flex min-h-[38px] w-full items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Back to Practice
          </button>
          <button
            type="button"
            onClick={onGoToDashboard}
            className="inline-flex min-h-[38px] w-full items-center justify-center rounded-lg border border-[var(--border2)] px-5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Go to Dashboard
          </button>
        </div>
      </section>
    </main>
  );
};
