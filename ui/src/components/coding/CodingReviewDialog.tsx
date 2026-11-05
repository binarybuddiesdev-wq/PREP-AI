import { Dialog } from '@base-ui/react/dialog';
import { LoaderCircle, Sparkles, X } from 'lucide-react';

import type { ICodingReviewDialogProps } from './CodingReviewDialog.types';

const reviewFailureMessage = (failureCode: string | null) =>
  failureCode === 'review_unavailable'
    ? 'The AI review service is temporarily unavailable. Please try again.'
    : failureCode || 'The AI review could not be completed. Please try again.';

export const CodingReviewDialog = (props: ICodingReviewDialogProps) => {
  const {
    isOpen,
    problemTitle,
    answer,
    isRequestPending,
    requestError,
    onOpenChange,
    onRequestReview,
  } = props;
  const review = answer.aiReviewJson;
  const canRequestReview =
    (!requestError || requestError.canRetry) &&
    (answer.aiReviewStatus === 'not_requested' ||
      answer.aiReviewStatus === 'failed' ||
      Boolean(requestError));

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/75 backdrop-blur-[3px] data-[open]:animate-in data-[open]:fade-in" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
          <Dialog.Popup className="relative max-h-[min(80dvh,48rem)] w-full max-w-[520px] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#18181b] p-5 text-zinc-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:p-7">
            <header className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
                  AI Review: {problemTitle}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-zinc-400">
                  Feedback on your submitted solution.
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close AI review"
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/[0.09] text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <X aria-hidden="true" className="size-4" />
              </Dialog.Close>
            </header>

            <div className="space-y-5">
              {requestError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-400/20 bg-rose-400/[0.07] p-3 text-sm text-rose-200"
                >
                  {requestError.message}
                </div>
              ) : null}

              {isRequestPending ||
              answer.aiReviewStatus === 'queued' ||
              answer.aiReviewStatus === 'running' ? (
                <p
                  role="status"
                  className="flex min-h-20 items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-[#111113] px-4 text-sm text-zinc-300"
                >
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-amber-300" />
                  {isRequestPending
                    ? 'Sending your review request…'
                    : answer.aiReviewStatus === 'queued'
                      ? 'Your AI review is queued…'
                      : 'Your AI review is running…'}
                </p>
              ) : answer.aiReviewStatus === 'failed' && !requestError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-rose-400/20 bg-rose-400/[0.07] p-3 text-sm text-rose-200"
                >
                  {reviewFailureMessage(answer.aiReviewFailureMessage)}
                </p>
              ) : answer.aiReviewStatus === 'completed' && review ? (
                <>
                  <p className="text-sm leading-6 text-zinc-300">{review.summary}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <section className="rounded-lg border border-white/[0.07] bg-[#111113] p-3">
                      <h3 className="text-xs font-semibold text-zinc-500">Time Complexity</h3>
                      <p className="mt-1.5 font-mono text-sm text-zinc-100">
                        {review.timeComplexity}
                      </p>
                    </section>
                    <section className="rounded-lg border border-white/[0.07] bg-[#111113] p-3">
                      <h3 className="text-xs font-semibold text-zinc-500">Space Complexity</h3>
                      <p className="mt-1.5 font-mono text-sm text-zinc-100">
                        {review.spaceComplexity}
                      </p>
                    </section>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <section aria-labelledby="coding-review-strengths">
                      <h3
                        id="coding-review-strengths"
                        className="text-sm font-semibold text-emerald-300"
                      >
                        Strengths
                      </h3>
                      {review.strengths.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-5 text-zinc-300">
                          {review.strengths.map((strength, index) => (
                            <li key={`strength-${index}`}>{strength}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-500">No strengths were provided.</p>
                      )}
                    </section>
                    <section aria-labelledby="coding-review-improvements">
                      <h3
                        id="coding-review-improvements"
                        className="text-sm font-semibold text-amber-300"
                      >
                        Suggestions
                      </h3>
                      {review.improvements.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-5 text-zinc-300">
                          {review.improvements.map((improvement, index) => (
                            <li key={`improvement-${index}`}>{improvement}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-zinc-500">No suggestions were provided.</p>
                      )}
                    </section>
                  </div>
                </>
              ) : answer.aiReviewStatus === 'completed' ? (
                <p role="status" className="text-sm text-zinc-400">
                  The review completed without structured feedback.
                </p>
              ) : (
                <div className="rounded-lg border border-white/[0.07] bg-[#111113] p-4 text-sm text-zinc-400">
                  <p>Get feedback on your approach, complexity, and possible improvements.</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Review availability depends on your account’s daily limit.
                  </p>
                </div>
              )}
            </div>

            <footer className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/[0.1] px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-amber-400">
                Got it
              </Dialog.Close>
              {canRequestReview ? (
                <button
                  type="button"
                  onClick={onRequestReview}
                  disabled={isRequestPending}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-semibold text-black transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-60"
                >
                  {isRequestPending ? (
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                  ) : answer.aiReviewStatus === 'failed' || requestError ? (
                    <LoaderCircle aria-hidden="true" className="size-4" />
                  ) : (
                    <Sparkles aria-hidden="true" className="size-4" />
                  )}
                  {isRequestPending
                    ? 'Requesting review…'
                    : answer.aiReviewStatus === 'failed' || requestError
                      ? 'Retry AI Review'
                      : 'Request AI Review'}
                </button>
              ) : null}
            </footer>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
