import { AlertTriangle, RotateCw } from 'lucide-react';

import type { IQueryErrorStateProps } from './QueryErrorState.types';

export const QueryErrorState = (props: IQueryErrorStateProps) => {
  const { title, description, details, onRetry, isRetrying = false } = props;

  return (
    <section
      role="alert"
      className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-5 text-left"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-rose-300" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p>
          {details ? <p className="mt-2 text-xs leading-5 text-zinc-500">{details}</p> : null}
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-wait disabled:opacity-60"
          >
            <RotateCw aria-hidden="true" className={`size-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      </div>
    </section>
  );
};
