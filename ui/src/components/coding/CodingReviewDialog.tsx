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
          <Dialog.Popup className="relative max-h-[min(80dvh,48rem)] w-full max-w-[520px] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-7">
            <header className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-lg font-semibold tracking-tight text-[var(--text-h)] sm:text-xl">
                  AI Review: {problemTitle}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-[var(--dim)]">
                  Feedback on your submitted solution.
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close AI review"
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--border2)] text-[var(--dim)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                <X aria-hidden="true" className="size-4" />
              </Dialog.Close>
            </header>

            <div className="space-y-5">
              {requestError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-[var(--red-bg)] bg-[var(--red-bg)] p-3 text-sm text-[var(--danger-strong)]"
                >
                  {requestError.message}
                </div>
              ) : null}

              {isRequestPending ||
              answer.aiReviewStatus === 'queued' ||
              answer.aiReviewStatus === 'running' ? (
                <p
                  role="status"
                  className="flex min-h-20 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-[var(--text)]"
                >
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin text-[var(--accent-strong)]"
                  />
                  {isRequestPending
                    ? 'Sending your review request…'
                    : answer.aiReviewStatus === 'queued'
                      ? 'Your AI review is queued…'
                      : 'Your AI review is running…'}
                </p>
              ) : answer.aiReviewStatus === 'failed' && !requestError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-[var(--red-bg)] bg-[var(--red-bg)] p-3 text-sm text-[var(--danger-strong)]"
                >
                  {reviewFailureMessage(answer.aiReviewFailureMessage)}
                </p>
              ) : answer.aiReviewStatus === 'completed' && review ? (
                <>
                  <p className="text-sm leading-6 text-[var(--text)]">{review.summary}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                      <h3 className="text-xs font-semibold text-[var(--dim)]">Time Complexity</h3>
                      <p className="mt-1.5 font-mono text-sm text-[var(--text)]">
                        {review.timeComplexity}
                      </p>
                    </section>
                    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                      <h3 className="text-xs font-semibold text-[var(--dim)]">Space Complexity</h3>
                      <p className="mt-1.5 font-mono text-sm text-[var(--text)]">
                        {review.spaceComplexity}
                      </p>
                    </section>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <section aria-labelledby="coding-review-strengths">
                      <h3
                        id="coding-review-strengths"
                        className="text-sm font-semibold text-[var(--success-strong)]"
                      >
                        Strengths
                      </h3>
                      {review.strengths.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-5 text-[var(--text)]">
                          {review.strengths.map((strength, index) => (
                            <li key={`strength-${index}`}>{strength}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-[var(--dim)]">
                          No strengths were provided.
                        </p>
                      )}
                    </section>
                    <section aria-labelledby="coding-review-improvements">
                      <h3
                        id="coding-review-improvements"
                        className="text-sm font-semibold text-[var(--accent-strong)]"
                      >
                        Suggestions
                      </h3>
                      {review.improvements.length > 0 ? (
                        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-5 text-[var(--text)]">
                          {review.improvements.map((improvement, index) => (
                            <li key={`improvement-${index}`}>{improvement}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-[var(--dim)]">
                          No suggestions were provided.
                        </p>
                      )}
                    </section>
                  </div>
                </>
              ) : answer.aiReviewStatus === 'completed' ? (
                <p role="status" className="text-sm text-[var(--dim)]">
                  The review completed without structured feedback.
                </p>
              ) : (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--dim)]">
                  <p>Get feedback on your approach, complexity, and possible improvements.</p>
                  <p className="mt-2 text-xs text-[var(--dim)]">
                    Review availability depends on your account’s daily limit.
                  </p>
                </div>
              )}
            </div>

            <footer className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border2)] px-4 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
                Got it
              </Dialog.Close>
              {canRequestReview ? (
                <button
                  type="button"
                  onClick={onRequestReview}
                  disabled={isRequestPending}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-black transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)] disabled:cursor-wait disabled:opacity-60"
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
