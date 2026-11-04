import { ArrowLeft, Check, CircleAlert, Clock3 } from 'lucide-react';

import type { ITheoryAnswer } from '@/core';
import { formatDate } from '@/utils';
import type { ITheorySessionDetailProps } from './TheorySessionDetail.types';

const hasPendingEvaluation = (answers: ITheoryAnswer[]) =>
  answers.some((answer) => answer.status === 'queued' || answer.status === 'running');

const getEvaluationLabel = (answer: ITheoryAnswer) => {
  switch (answer.status) {
    case 'queued':
      return 'Evaluation queued';
    case 'running':
      return 'Evaluation in progress';
    case 'completed':
      return 'Evaluation complete';
    case 'failed':
      return 'Evaluation failed';
  }
};

export const TheorySessionDetail = (props: ITheorySessionDetailProps) => {
  const { session, isCompleting, completionError, onComplete, onReturnToHistory } = props;
  const scoredAnswers = session.answers.filter((answer) => answer.aiScore !== null);
  const isInProgress = session.status === 'in_progress';
  const hasActiveEvaluation = hasPendingEvaluation(session.answers);
  const averageScore =
    scoredAnswers.length > 0 ? `${session.avgScore.toFixed(1)} / 10` : 'No scored answers';
  const modeLabel =
    session.mode === 'weak'
      ? 'Weak areas'
      : session.mode === 'pdf'
        ? 'PDF study'
        : 'Topic practice';

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5">
      <button
        type="button"
        onClick={onReturnToHistory}
        className="inline-flex min-h-9 items-center gap-2 rounded-md text-sm text-zinc-400 transition hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to history
      </button>

      <section className="rounded-xl border border-white/[0.08] bg-[#18181b] p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Session details</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Started <time dateTime={session.startedAt}>{formatDate(session.startedAt)}</time>
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isInProgress ? 'bg-amber-400/10 text-amber-200' : 'bg-emerald-400/10 text-emerald-200'
            }`}
          >
            {isInProgress ? 'In progress' : 'Completed'}
          </span>
        </header>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-black/15 p-3">
            <dt className="text-xs text-zinc-500">Practice type</dt>
            <dd className="mt-1 text-sm font-medium text-zinc-200">{modeLabel}</dd>
          </div>
          <div className="rounded-lg bg-black/15 p-3">
            <dt className="text-xs text-zinc-500">Topic</dt>
            <dd className="mt-1 truncate text-sm font-medium text-zinc-200">
              {session.topicId ?? '—'}
            </dd>
          </div>
          <div className="rounded-lg bg-black/15 p-3">
            <dt className="text-xs text-zinc-500">Answers submitted</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums text-zinc-200">
              {session.questionsAnswered} / {session.totalQuestions}
            </dd>
          </div>
          <div className="rounded-lg bg-black/15 p-3">
            <dt className="text-xs text-zinc-500">Average score</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums text-amber-200">{averageScore}</dd>
          </div>
        </dl>

        <p className="mt-4 text-sm leading-6 text-zinc-400">
          This page contains submitted answers only. Skipped or unanswered questions cannot be
          resumed here.
        </p>

        {completionError ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] p-3"
          >
            <p className="text-sm text-rose-200">{completionError}</p>
          </div>
        ) : null}

        {isInProgress && hasActiveEvaluation ? (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-amber-200">
            <Clock3 aria-hidden="true" className="size-4 shrink-0" />
            Evaluation is still in progress. You can finish this saved session when it is complete.
          </p>
        ) : null}

        {isInProgress && !hasActiveEvaluation ? (
          <button
            type="button"
            disabled={isCompleting}
            onClick={onComplete}
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-wait disabled:opacity-60"
          >
            {isCompleting ? 'Finishing session…' : 'Finish saved session'}
          </button>
        ) : null}

        {!isInProgress ? (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-emerald-200">
            <Check aria-hidden="true" className="size-4" />
            Session completed.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="session-answers-heading" className="space-y-3">
        <h2 id="session-answers-heading" className="text-lg font-semibold text-zinc-100">
          Saved answers{' '}
          <span className="text-sm font-normal text-zinc-500">({session.answers.length})</span>
        </h2>
        {session.answers.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] bg-[#18181b] p-4 text-sm text-zinc-400">
            No answers were submitted in this session.
          </p>
        ) : (
          session.answers.map((answer, index) => (
            <article
              key={answer.id}
              className="rounded-xl border border-white/[0.08] bg-[#18181b] p-4 sm:p-5"
            >
              <header className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">Question {index + 1}</h3>
                <span className="text-xs text-zinc-400">{getEvaluationLabel(answer)}</span>
              </header>
              <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-6 text-zinc-200">
                {answer.questionText}
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Your answer
              </p>
              <p className="mt-1 break-words whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                {answer.userAnswer}
              </p>
              {answer.status === 'completed' ? (
                <p className="mt-3 text-sm font-medium text-amber-200">
                  {answer.aiScore === null ? 'No score returned' : `Score: ${answer.aiScore} / 10`}
                </p>
              ) : null}
              {answer.aiFeedback ? (
                <p className="mt-2 break-words rounded-md bg-amber-400/[0.08] p-3 text-sm leading-6 text-amber-100">
                  {answer.aiFeedback}
                </p>
              ) : null}
              {answer.status === 'failed' && answer.failureMessage ? (
                <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-rose-300">
                  <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />
                  {answer.failureMessage}
                </p>
              ) : null}
            </article>
          ))
        )}
      </section>
    </main>
  );
};
