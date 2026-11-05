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
    <article className="rounded-lg border border-white/[0.07] bg-[#111113] p-3 sm:p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">{problemTitle}</h3>
          <p className="mt-1 text-xs text-zinc-500">{languageLabels[answer.language]}</p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            answer.status === 'accepted'
              ? 'bg-emerald-400/10 text-emerald-300'
              : 'bg-rose-400/10 text-rose-300'
          }`}
        >
          {verdictLabels[answer.status]}
        </span>
      </header>
      <p className="mt-3 text-xs text-zinc-400">
        {answer.testCasesPassed} / {answer.testCasesTotal} tests passed
      </p>
      <div className="mt-3">
        <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Submitted code
        </h4>
        <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-black/30 p-3 text-xs leading-5 text-zinc-300">
          <code>{answer.code}</code>
        </pre>
      </div>
      {answer.aiReviewStatus === 'queued' || answer.aiReviewStatus === 'running' ? (
        <p className="mt-3 text-sm text-zinc-400" role="status">
          {answer.aiReviewStatus === 'queued' ? 'AI review queued.' : 'AI review in progress.'}
        </p>
      ) : answer.aiReviewStatus === 'failed' ? (
        <p className="mt-3 rounded-md bg-rose-400/[0.07] p-3 text-sm text-rose-200" role="alert">
          {reviewFailureMessage(answer.aiReviewFailureMessage)}
        </p>
      ) : answer.aiReviewStatus === 'completed' && review ? (
        <section className="mt-4 border-t border-white/[0.07] pt-3">
          <h4 className="text-sm font-semibold text-violet-200">AI review</h4>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{review.summary}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">Time complexity</dt>
              <dd className="mt-1 font-mono text-zinc-200">{review.timeComplexity}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Space complexity</dt>
              <dd className="mt-1 font-mono text-zinc-200">{review.spaceComplexity}</dd>
            </div>
          </dl>
          {review.strengths.length > 0 ? (
            <div className="mt-3">
              <h5 className="text-xs font-semibold text-emerald-300">Strengths</h5>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-300">
                {review.strengths.map((strength, index) => (
                  <li key={`strength-${index}`}>{strength}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.improvements.length > 0 ? (
            <div className="mt-3">
              <h5 className="text-xs font-semibold text-amber-300">Suggestions</h5>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-300">
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
