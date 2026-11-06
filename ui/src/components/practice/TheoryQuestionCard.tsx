import { Clock3, Send } from 'lucide-react';
import { Link } from 'react-router';

import type { ITheoryQuestionCardProps } from './TheoryQuestionCard.types';

const formatElapsed = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export const TheoryQuestionCard = (props: ITheoryQuestionCardProps) => {
  const {
    question,
    currentQuestion,
    totalQuestions,
    elapsedSeconds,
    answerDraft,
    isSubmitting,
    isAnswerFrozen,
    submitError,
    submitted,
    onAnswerChange,
    onSubmit,
    onSkip,
    onEnd,
  } = props;
  const progress = totalQuestions > 0 ? (currentQuestion / totalQuestions) * 100 : 0;

  return (
    <main className="w-full space-y-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-[1.35rem] font-bold text-[var(--text-h)]">Practice Session</h1>
        </div>
        <div className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm tabular-nums text-[var(--text)]">
          <Clock3 aria-hidden="true" className="size-4 text-[var(--accent-strong)]" />
          <span aria-label="Elapsed time">{formatElapsed(elapsedSeconds)}</span>
        </div>
      </header>

      <section className="app-shell-panel rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-8 py-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[var(--dim)]">
            <span>
              Question {currentQuestion} of {totalQuestions}
            </span>
            {question.difficulty ? <span>{question.difficulty}</span> : null}
          </div>
          <div
            role="progressbar"
            aria-label="Question progress"
            aria-valuemin={0}
            aria-valuemax={totalQuestions}
            aria-valuenow={currentQuestion}
            className="h-1.5 overflow-hidden rounded-full bg-[var(--surface2)]"
          >
            <span
              className="block h-full rounded-full bg-[var(--accent)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="space-y-5 p-6 sm:p-8">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--accent-strong)]">
              Interview question
            </p>
            <h2 className="text-[1.05rem] leading-[1.7] font-semibold text-[var(--text-h)]">
              {question.question}
            </h2>
          </div>

          {question.citations?.length ? (
            <div aria-label="Source citations" className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[var(--dim)]">Sources</span>
              {question.citations.map((citation) => (
                <Link
                  key={`${citation.pdfId}:${citation.page}:${citation.chunkId}`}
                  to={`/library?pdfId=${encodeURIComponent(citation.pdfId)}&page=${citation.page}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-8 items-center rounded-md border border-[var(--blue-bg)] bg-[var(--blue-bg)] px-2.5 text-xs font-medium text-[var(--info-strong)] transition hover:border-[var(--info-strong)] hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  {citation.displayName} · Page {citation.page}
                </Link>
              ))}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="theory-answer"
              className="mb-2 block text-sm font-medium text-[var(--text)]"
            >
              Your answer
            </label>
            <textarea
              id="theory-answer"
              value={answerDraft}
              onChange={(event) => onAnswerChange(event.currentTarget.value)}
              disabled={submitted || isSubmitting || isAnswerFrozen}
              rows={6}
              placeholder="Write your answer here…"
              className="min-h-[150px] w-full resize-y rounded-xl border border-[var(--border2)] bg-[var(--bg2)] p-4 text-sm leading-[1.6] text-[var(--text)] outline-none transition placeholder:text-[var(--dim)] focus:border-[var(--accent-border)] focus:ring-2 focus:ring-[var(--accent-bg)] disabled:opacity-70"
            />
          </div>

          {submitError ? (
            <p
              role="alert"
              className="rounded-lg border border-[var(--red-bg)] bg-[var(--red-bg)] p-3 text-sm text-[var(--danger-strong)]"
            >
              {submitError}
            </p>
          ) : null}
          {submitted ? (
            <p
              role="status"
              className="rounded-lg border border-[var(--blue-bg)] bg-[var(--blue-bg)] p-3 text-sm text-[var(--info-strong)]"
            >
              Answer saved. Evaluation is being prepared.
            </p>
          ) : null}

          {!submitted ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onSkip}
                  className="min-h-10 rounded-lg border border-[var(--border2)] px-3.5 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Skip question
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onEnd}
                  className="min-h-10 rounded-lg px-3.5 text-sm text-[var(--dim)] transition hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
                >
                  End session
                </button>
              </div>
              <button
                type="button"
                disabled={isSubmitting || !answerDraft.trim()}
                onClick={onSubmit}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-zinc-950 transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send aria-hidden="true" className="size-4" />
                {isSubmitting ? 'Submitting…' : isAnswerFrozen ? 'Retry answer' : 'Submit answer'}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
};
