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
    <main className="mx-auto w-full max-w-4xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-[var(--text-h)]">Practice session</h1>
          <p className="text-sm text-zinc-400">Answer in your own words. Your time is recorded.</p>
        </div>
        <div className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-[#18181b] px-3 text-sm tabular-nums text-zinc-300">
          <Clock3 aria-hidden="true" className="size-4 text-amber-300" />
          <span aria-label="Elapsed time">{formatElapsed(elapsedSeconds)}</span>
        </div>
      </header>

      <section className="app-shell-panel rounded-xl border border-white/[0.08] bg-[#18181b]">
        <div className="border-b border-white/[0.06] px-4 py-4 sm:px-6">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-zinc-400">
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
            className="h-1.5 overflow-hidden rounded-full bg-white/10"
          >
            <span
              className="block h-full rounded-full bg-amber-400"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-300">
              Interview question
            </p>
            <h2 className="text-lg font-semibold leading-7 text-zinc-100">{question.question}</h2>
          </div>

          {question.citations?.length ? (
            <div aria-label="Source citations" className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">Sources</span>
              {question.citations.map((citation) => (
                <Link
                  key={`${citation.pdfId}:${citation.page}:${citation.chunkId}`}
                  to={`/library?pdfId=${encodeURIComponent(citation.pdfId)}&page=${citation.page}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-8 items-center rounded-md border border-sky-300/20 bg-sky-300/[0.06] px-2.5 text-xs font-medium text-sky-200 transition hover:border-sky-300/35 hover:bg-sky-300/10 focus-visible:outline-2 focus-visible:outline-amber-400"
                >
                  {citation.displayName} · Page {citation.page}
                </Link>
              ))}
            </div>
          ) : null}

          <div>
            <label htmlFor="theory-answer" className="mb-2 block text-sm font-medium text-zinc-300">
              Your answer
            </label>
            <textarea
              id="theory-answer"
              value={answerDraft}
              onChange={(event) => onAnswerChange(event.currentTarget.value)}
              disabled={submitted || isSubmitting || isAnswerFrozen}
              rows={6}
              placeholder="Write your answer here…"
              className="w-full resize-y rounded-lg border border-white/10 bg-[#101012] px-3.5 py-3 text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 disabled:opacity-70"
            />
          </div>

          {submitError ? (
            <p
              role="alert"
              className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] p-3 text-sm text-rose-300"
            >
              {submitError}
            </p>
          ) : null}
          {submitted ? (
            <p
              role="status"
              className="rounded-lg border border-sky-400/15 bg-sky-400/[0.05] p-3 text-sm text-sky-200"
            >
              Answer saved. Evaluation is being prepared.
            </p>
          ) : null}

          {!submitted ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onSkip}
                  className="min-h-10 rounded-lg border border-white/10 px-3.5 text-sm text-zinc-300 transition hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Skip question
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onEnd}
                  className="min-h-10 rounded-lg px-3.5 text-sm text-zinc-500 transition hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50"
                >
                  End session
                </button>
              </div>
              <button
                type="button"
                disabled={isSubmitting || !answerDraft.trim()}
                onClick={onSubmit}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
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
