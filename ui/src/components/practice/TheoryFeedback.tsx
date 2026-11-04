import { CheckCircle2, RotateCw, XCircle } from 'lucide-react';

import type { ITheoryFeedbackProps } from './TheoryFeedback.types';

export const TheoryFeedback = (props: ITheoryFeedbackProps) => {
  const {
    answer,
    evaluationError,
    isRefreshing,
    isEnding,
    isCompleting,
    canContinue,
    onRetryEvaluation,
    onContinue,
    onEnd,
  } = props;
  const isPending = answer.status === 'queued' || answer.status === 'running';

  return (
    <section
      aria-labelledby="theory-feedback-title"
      className="app-shell-panel mt-4 rounded-xl border border-white/[0.08] bg-[#18181b] p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        {answer.status === 'completed' ? (
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-300" />
        ) : answer.status === 'failed' ? (
          <XCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-rose-300" />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 id="theory-feedback-title" className="text-sm font-semibold text-zinc-100">
            {isPending
              ? 'Evaluating your answer'
              : answer.status === 'failed'
                ? 'Answer not scored'
                : 'Answer feedback'}
          </h2>
          {isPending ? (
            <p role="status" className="mt-1 text-sm leading-6 text-zinc-400">
              Evaluation is in progress. You can continue when it finishes.
            </p>
          ) : answer.status === 'failed' ? (
            <p className="mt-1 text-sm leading-6 text-zinc-300">
              {answer.failureMessage || 'This answer could not be evaluated.'}
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {answer.aiScore !== null ? (
                <span className="text-lg font-semibold tabular-nums text-amber-200">
                  {answer.aiScore.toFixed(1)}/10
                </span>
              ) : (
                <span className="text-sm text-zinc-400">No score was returned.</span>
              )}
              {answer.aiFeedback ? (
                <p className="basis-full text-sm leading-6 text-zinc-300">{answer.aiFeedback}</p>
              ) : null}
            </div>
          )}
          {evaluationError ? (
            <div role="alert" className="mt-3 space-y-2">
              <p className="text-sm text-rose-300">{evaluationError}</p>
              <button
                type="button"
                disabled={isRefreshing}
                onClick={onRetryEvaluation}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-60"
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
            <p role="status" className="mt-3 text-xs text-amber-200">
              Session end requested. It will finish after evaluation is available.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-white/[0.06] pt-4">
        <button
          type="button"
          disabled={isCompleting}
          onClick={onEnd}
          className="min-h-10 rounded-lg px-3.5 text-sm text-zinc-400 transition hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50"
        >
          {isEnding ? 'Waiting to finish…' : 'End session'}
        </button>
        <button
          type="button"
          disabled={!canContinue || isEnding || isCompleting}
          onClick={onContinue}
          className="min-h-10 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </section>
  );
};
