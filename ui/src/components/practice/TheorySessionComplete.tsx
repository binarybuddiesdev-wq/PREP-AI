import { Check, RotateCw } from 'lucide-react';

import type { ITheorySessionCompleteProps } from './TheorySessionComplete.types';

export const TheorySessionComplete = (props: ITheorySessionCompleteProps) => {
  const { session, answers, onPracticeAgain } = props;
  const scoredAnswers = answers.filter((answer) => answer.aiScore !== null);
  const failedAnswers = answers.filter((answer) => answer.status === 'failed');

  return (
    <main className="mx-auto w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-7">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-[var(--green-bg)] text-[var(--success-strong)]">
          <Check aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mb-1 text-2xl font-semibold text-[var(--text-h)]">Session complete</h1>
        <p className="text-sm text-[var(--dim)]">
          Your submitted answers are saved in session history.
        </p>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <dt className="text-xs text-[var(--dim)]">Answers submitted</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-h)]">
            {session.questionsAnswered}
          </dd>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <dt className="text-xs text-[var(--dim)]">Answers scored</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-h)]">
            {scoredAnswers.length}
          </dd>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
          <dt className="text-xs text-[var(--dim)]">Session average</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--accent-strong)]">
            {scoredAnswers.length > 0 ? `${session.avgScore.toFixed(1)}/10` : 'No scored answers'}
          </dd>
        </div>
      </dl>

      {failedAnswers.length > 0 ? (
        <p className="mt-3 text-center text-xs text-[var(--dim)]">
          {failedAnswers.length} {failedAnswers.length === 1 ? 'answer could' : 'answers could'} not
          be scored.
        </p>
      ) : null}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={onPracticeAgain}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-zinc-950 transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <RotateCw aria-hidden="true" className="size-4" />
          Practice again
        </button>
      </div>
    </main>
  );
};
