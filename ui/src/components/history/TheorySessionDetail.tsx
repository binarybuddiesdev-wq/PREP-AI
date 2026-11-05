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
        className="inline-flex min-h-9 items-center gap-2 rounded-md text-sm text-[var(--dim)] transition hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to history
      </button>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-h)]">Session details</h1>
            <p className="mt-1 text-sm text-[var(--dim)]">
              Started <time dateTime={session.startedAt}>{formatDate(session.startedAt)}</time>
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              isInProgress
                ? 'bg-[var(--accent-bg)] text-[var(--accent-strong)]'
                : 'bg-[var(--green-bg)] text-[var(--success-strong)]'
            }`}
          >
            {isInProgress ? 'In progress' : 'Completed'}
          </span>
        </header>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-[var(--surface)] p-3">
            <dt className="text-xs text-[var(--dim)]">Practice type</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--text)]">{modeLabel}</dd>
          </div>
          <div className="rounded-lg bg-[var(--surface)] p-3">
            <dt className="text-xs text-[var(--dim)]">Topic</dt>
            <dd className="mt-1 truncate text-sm font-medium text-[var(--text)]">
              {session.topicId ?? '—'}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--surface)] p-3">
            <dt className="text-xs text-[var(--dim)]">Answers submitted</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums text-[var(--text)]">
              {session.questionsAnswered} / {session.totalQuestions}
            </dd>
          </div>
          <div className="rounded-lg bg-[var(--surface)] p-3">
            <dt className="text-xs text-[var(--dim)]">Average score</dt>
            <dd className="mt-1 text-sm font-medium tabular-nums text-[var(--accent-strong)]">
              {averageScore}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-sm leading-6 text-[var(--dim)]">
          This page contains submitted answers only. Skipped or unanswered questions cannot be
          resumed here.
        </p>

        {completionError ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-[var(--red-bg)] bg-[var(--red-bg)] p-3"
          >
            <p className="text-sm text-[var(--danger-strong)]">{completionError}</p>
          </div>
        ) : null}

        {isInProgress && hasActiveEvaluation ? (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 text-sm text-[var(--accent-strong)]"
          >
            <Clock3 aria-hidden="true" className="size-4 shrink-0" />
            Evaluation is still in progress. You can finish this saved session when it is complete.
          </p>
        ) : null}

        {isInProgress && !hasActiveEvaluation ? (
          <button
            type="button"
            disabled={isCompleting}
            onClick={onComplete}
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-zinc-950 transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
          >
            {isCompleting ? 'Finishing session…' : 'Finish saved session'}
          </button>
        ) : null}

        {!isInProgress ? (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 text-sm text-[var(--success-strong)]"
          >
            <Check aria-hidden="true" className="size-4" />
            Session completed.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="session-answers-heading" className="space-y-3">
        <h2 id="session-answers-heading" className="text-lg font-semibold text-[var(--text-h)]">
          Saved answers{' '}
          <span className="text-sm font-normal text-[var(--dim)]">({session.answers.length})</span>
        </h2>
        {session.answers.length === 0 ? (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--dim)]">
            No answers were submitted in this session.
          </p>
        ) : (
          session.answers.map((answer, index) => (
            <article
              key={answer.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5"
            >
              <header className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--text-h)]">Question {index + 1}</h3>
                <span className="text-xs text-[var(--dim)]">{getEvaluationLabel(answer)}</span>
              </header>
              <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-6 text-[var(--text)]">
                {answer.questionText}
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[var(--dim)]">
                Your answer
              </p>
              <p className="mt-1 break-words whitespace-pre-wrap text-sm leading-6 text-[var(--text)]">
                {answer.userAnswer}
              </p>
              {answer.status === 'completed' ? (
                <p className="mt-3 text-sm font-medium text-[var(--accent-strong)]">
                  {answer.aiScore === null ? 'No score returned' : `Score: ${answer.aiScore} / 10`}
                </p>
              ) : null}
              {answer.aiFeedback ? (
                <p className="mt-2 break-words rounded-md bg-[var(--accent-bg)] p-3 text-sm leading-6 text-[var(--accent-strong)]">
                  {answer.aiFeedback}
                </p>
              ) : null}
              {answer.status === 'failed' && answer.failureMessage ? (
                <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-[var(--danger-strong)]">
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
