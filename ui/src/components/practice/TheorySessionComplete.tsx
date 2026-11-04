import { Check, RotateCw } from 'lucide-react';

import type { ITheorySessionCompleteProps } from './TheorySessionComplete.types';

export const TheorySessionComplete = (props: ITheorySessionCompleteProps) => {
  const { session, answers, onPracticeAgain } = props;
  const scoredAnswers = answers.filter((answer) => answer.aiScore !== null);
  const failedAnswers = answers.filter((answer) => answer.status === 'failed');

  return (
    <main className="mx-auto w-full max-w-3xl rounded-xl border border-white/[0.08] bg-[#18181b] p-5 sm:p-7">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-emerald-400/10 text-emerald-300">
          <Check aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mb-1 text-2xl font-semibold text-zinc-100">Session complete</h1>
        <p className="text-sm text-zinc-400">
          Your submitted answers are saved in session history.
        </p>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/[0.07] bg-black/10 p-3 text-center">
          <dt className="text-xs text-zinc-400">Answers submitted</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">
            {session.questionsAnswered}
          </dd>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-black/10 p-3 text-center">
          <dt className="text-xs text-zinc-400">Answers scored</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">
            {scoredAnswers.length}
          </dd>
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-black/10 p-3 text-center">
          <dt className="text-xs text-zinc-400">Session average</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-amber-200">
            {scoredAnswers.length > 0 ? `${session.avgScore.toFixed(1)}/10` : 'No scored answers'}
          </dd>
        </div>
      </dl>

      {failedAnswers.length > 0 ? (
        <p className="mt-3 text-center text-xs text-zinc-400">
          {failedAnswers.length} {failedAnswers.length === 1 ? 'answer could' : 'answers could'} not
          be scored.
        </p>
      ) : null}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={onPracticeAgain}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-500 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          <RotateCw aria-hidden="true" className="size-4" />
          Practice again
        </button>
      </div>
    </main>
  );
};
