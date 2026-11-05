import type { ICodingSubmissionDetailProps } from './CodingSubmissionDetail.types';

const languageLabels = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
} as const;

const verdictLabels = {
  accepted: 'Accepted',
  wrong_answer: 'Wrong answer',
  error: 'Execution error',
} as const;

const reviewFailureMessage = (failureMessage: string | null) =>
  failureMessage === 'review_unavailable'
    ? 'The AI review service was unavailable for this submission.'
    : failureMessage || 'The AI review could not be completed.';

export const CodingSubmissionDetail = (props: ICodingSubmissionDetailProps) => {
  const { answer, problemTitle } = props;
  const review = answer.aiReviewJson;

  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-h)]">{problemTitle}</h3>
          <p className="mt-1 text-xs text-[var(--dim)]">{languageLabels[answer.language]}</p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            answer.status === 'accepted'
              ? 'bg-[var(--green-bg)] text-[var(--success-strong)]'
              : 'bg-[var(--red-bg)] text-[var(--danger-strong)]'
          }`}
        >
          {verdictLabels[answer.status]}
        </span>
      </header>
      <p className="mt-3 text-xs text-[var(--dim)]">
        {answer.testCasesPassed} / {answer.testCasesTotal} tests passed
      </p>
      <div className="mt-3">
        <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--dim)]">
          Submitted code
        </h4>
        <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-[var(--bg2)] p-3 text-xs leading-5 text-[var(--text)]">
          <code>{answer.code}</code>
        </pre>
      </div>
      {answer.aiReviewStatus === 'queued' || answer.aiReviewStatus === 'running' ? (
        <p className="mt-3 text-sm text-[var(--dim)]" role="status">
          {answer.aiReviewStatus === 'queued' ? 'AI review queued.' : 'AI review in progress.'}
        </p>
      ) : answer.aiReviewStatus === 'failed' ? (
        <p
          className="mt-3 rounded-md bg-[var(--red-bg)] p-3 text-sm text-[var(--danger-strong)]"
          role="alert"
        >
          {reviewFailureMessage(answer.aiReviewFailureMessage)}
        </p>
      ) : answer.aiReviewStatus === 'completed' && review ? (
        <section className="mt-4 border-t border-[var(--border)] pt-3">
          <h4 className="text-sm font-semibold text-[var(--purple-strong)]">AI review</h4>
          <p className="mt-2 text-sm leading-6 text-[var(--text)]">{review.summary}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-[var(--dim)]">Time complexity</dt>
              <dd className="mt-1 font-mono text-[var(--text)]">{review.timeComplexity}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--dim)]">Space complexity</dt>
              <dd className="mt-1 font-mono text-[var(--text)]">{review.spaceComplexity}</dd>
            </div>
          </dl>
          {review.strengths.length > 0 ? (
            <div className="mt-3">
              <h5 className="text-xs font-semibold text-[var(--success-strong)]">Strengths</h5>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--text)]">
                {review.strengths.map((strength, index) => (
                  <li key={`strength-${index}`}>{strength}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.improvements.length > 0 ? (
            <div className="mt-3">
              <h5 className="text-xs font-semibold text-[var(--accent-strong)]">Suggestions</h5>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--text)]">
                {review.improvements.map((improvement, index) => (
                  <li key={`improvement-${index}`}>{improvement}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
};
