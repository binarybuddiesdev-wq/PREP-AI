import { Clock3, Send, X } from 'lucide-react';
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
    <section
      aria-labelledby="theory-question-title"
      className="app-shell-panel w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-mono text-[0.825rem] font-semibold text-[var(--text)]">
          Q{currentQuestion} of {totalQuestions}
        </span>
        <div className="flex items-center gap-2">
          <div className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 font-mono text-[0.78rem] tabular-nums text-[var(--dim)]">
            <Clock3 aria-hidden="true" className="size-[13px]" />
            <span aria-label="Elapsed time">{formatElapsed(elapsedSeconds)}</span>
          </div>
          <button
            type="button"
            aria-label="End session"
            title="End session"
            onClick={onEnd}
            className="grid size-8 place-items-center rounded-lg text-[var(--dim)] transition hover:bg-[var(--surface)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <div className="mb-6 h-1 overflow-hidden rounded-full bg-[var(--surface)]">
        <div
          role="progressbar"
          aria-label="Question progress"
          aria-valuemin={0}
          aria-valuemax={totalQuestions}
          aria-valuenow={currentQuestion}
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h2
        id="theory-question-title"
        className="mb-6 text-[1.05rem] leading-[1.7] font-normal text-[var(--text)]"
      >
        {question.question}
      </h2>

      {question.citations?.length ? (
        <div aria-label="Source citations" className="mb-5 flex flex-wrap items-center gap-2">
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

      <label htmlFor="theory-answer" className="sr-only">
        Your answer
      </label>
      <textarea
        id="theory-answer"
        value={answerDraft}
        onChange={(event) => onAnswerChange(event.currentTarget.value)}
        disabled={submitted || isSubmitting || isAnswerFrozen}
        placeholder="Type your answer here..."
        className="mb-5 min-h-[150px] w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 text-[0.875rem] leading-[1.6] text-[var(--text)] outline-none transition placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[rgba(245,158,11,0.1)] disabled:opacity-70"
      />

      {submitError ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-[var(--red-bg)] bg-[var(--red-bg)] p-3 text-sm text-[var(--danger-strong)]"
        >
          {submitError}
        </p>
      ) : null}
      {submitted ? (
        <p role="status" className="sr-only">
          Answer saved. Evaluation is being prepared.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            aria-label="Skip question"
            disabled={isSubmitting}
            onClick={onSkip}
            className="min-h-10 rounded-lg border border-[var(--border2)] px-4 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            aria-label={isAnswerFrozen ? 'Retry answer' : 'Submit answer'}
            disabled={isSubmitting || !answerDraft.trim()}
            onClick={onSubmit}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-zinc-950 transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send aria-hidden="true" className="size-4" />
            {isSubmitting ? 'Submitting…' : isAnswerFrozen ? 'Retry answer' : 'Submit Answer'}
          </button>
        </div>
      )}
    </section>
  );
};
