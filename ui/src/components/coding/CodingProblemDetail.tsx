import { ArrowLeft } from 'lucide-react';

import { CodingProblemContent } from './CodingProblemContent';
import type { ICodingProblemDetailProps } from './CodingProblemDetail.types';

export const CodingProblemDetail = (props: ICodingProblemDetailProps) => {
  const { problem, onBack } = props;

  return (
    <article className="mx-auto w-full max-w-4xl">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-[var(--dim)] transition hover:bg-[var(--surface)] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to problems
      </button>
      <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <CodingProblemContent problem={problem} />
      </div>
    </article>
  );
};
