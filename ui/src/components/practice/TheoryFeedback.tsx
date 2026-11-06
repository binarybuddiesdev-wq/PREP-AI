import { RotateCw } from 'lucide-react';

import type { ITheoryFeedbackProps } from './TheoryFeedback.types';

const getVerdict = (score: number) => {
  if (score >= 8) return 'Excellent Answer!';
  if (score >= 7) return 'Good Answer!';
  return 'Decent Answer!';
};

export const TheoryFeedback = (props: ITheoryFeedbackProps) => {
  const {
    answer,
    evaluationError,
    isRefreshing,
    isEnding,
    isCompleting,
    isRestarting,
    canContinue,
    onRetryEvaluation,
    onContinue,
    onPracticeSameTopic,
    onEnd,
  } = props;
  const isPending = answer.status === 'queued' || answer.status === 'running';
  const hasScore = answer.status === 'completed' && answer.aiScore !== null;
  const score = answer.aiScore ?? 0;
  const safeScore = Math.max(0, Math.min(10, score));
  const ringOffset = 283 - (safeScore / 10) * 283;

  return (
    <section
      aria-labelledby="theory-feedback-title"
      className="app-shell-panel h-fit rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8"
    >
      <div className="mb-6 text-center">
        {hasScore ? (
          <div
            role="progressbar"
            aria-label="Answer score"
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={score}
            className="relative mx-auto mb-2 size-[110px]"
          >
            <svg aria-hidden="true" viewBox="0 0 110 110" className="size-full -rotate-90">
              <defs>
                <linearGradient id="theory-feedback-gradient" x1="0%" y1="0%" x2="100%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
              </defs>
              <circle cx="55" cy="55" r="45" fill="none" stroke="var(--surface2)" strokeWidth="7" />
              <circle
                cx="55"
                cy="55"
                r="45"
                fill="none"
                stroke="url(#theory-feedback-gradient)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray="283"
                strokeDashoffset={ringOffset}
                className="transition-[stroke-dashoffset] duration-1000"
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[1.8rem] font-bold leading-none tabular-nums text-[var(--text)]">
                {score.toFixed(1)}
              </span>
              <span className="text-[0.65rem] text-[var(--dim)]">/ 10</span>
            </span>
          </div>
        ) : isPending ? (
          <div className="mx-auto mb-2 grid size-[110px] place-items-center rounded-full border-[7px] border-[var(--surface2)] text-[var(--accent-strong)]">
            <RotateCw aria-hidden="true" className="size-7 animate-spin" />
            <span role="status" className="sr-only">
              Evaluation is in progress
            </span>
          </div>
        ) : null}

        <h2
          id="theory-feedback-title"
          className={hasScore ? 'sr-only' : 'text-base font-semibold text-[var(--text-h)]'}
        >
          {hasScore
            ? `Answer feedback: ${score.toFixed(1)} out of 10`
            : isPending
              ? 'Evaluating your answer'
              : 'Answer not scored'}
        </h2>
        {hasScore ? (
          <p className="mb-[0.4rem] mt-0 text-base font-semibold text-[var(--text)]">
            {getVerdict(score)}
          </p>
        ) : null}
      </div>

      {isPending ? (
        <p className="mb-6 text-sm leading-6 text-[var(--dim)]">
          Evaluation is in progress. You can continue when it finishes.
        </p>
      ) : answer.status === 'failed' ? (
        <p className="mb-6 text-sm leading-[1.7] text-[var(--dim)]">
          {answer.failureMessage || 'This answer could not be evaluated.'}
        </p>
      ) : answer.aiFeedback ? (
        <p className="mb-6 text-[0.85rem] leading-[1.7] text-[var(--dim)]">{answer.aiFeedback}</p>
      ) : (
        <p className="mb-6 text-sm text-[var(--dim)]">No written feedback was returned.</p>
      )}

      {evaluationError ? (
        <div role="alert" className="mb-4 space-y-2">
          <p className="text-sm text-[var(--danger-strong)]">{evaluationError}</p>
          <button
            type="button"
            disabled={isRefreshing}
            onClick={onRetryEvaluation}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
          >
            <RotateCw
              aria-hidden="true"
              className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            {isRefreshing ? 'Retrying…' : 'Retry evaluation'}
          </button>
        </div>
      ) : null}
      {isEnding ? (
        <p role="status" className="mb-4 text-xs text-[var(--accent-strong)]">
          Session end requested. It will finish after evaluation is available.
        </p>
      ) : null}

      <div className="flex flex-col gap-[0.6rem] border-t border-[var(--border)] pt-4">
        <button
          type="button"
          disabled={!canContinue || isEnding || isCompleting || isRestarting}
          onClick={onContinue}
          className="min-h-10 w-full rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next Question
        </button>
        <button
          type="button"
          disabled={!canContinue || isEnding || isCompleting || isRestarting}
          onClick={onPracticeSameTopic}
          className="min-h-10 w-full rounded-lg border border-[var(--border2)] px-4 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-50"
        >
          {isRestarting ? 'Starting again…' : 'Practice Same Topic Again'}
        </button>
        <button
          type="button"
          disabled={isCompleting || isRestarting}
          onClick={onEnd}
          className="min-h-10 w-full rounded-lg px-3.5 text-sm text-[var(--dim)] transition hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
        >
          {isEnding ? 'Waiting to finish…' : 'End Session'}
        </button>
      </div>
    </section>
  );
};
