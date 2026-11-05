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
        className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to problems
      </button>
      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#18181b]">
        <CodingProblemContent problem={problem} />
      </div>
    </article>
  );
};
