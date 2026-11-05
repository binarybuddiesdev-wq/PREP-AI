import { AlertTriangle, RotateCw } from 'lucide-react';

import type { IQueryErrorStateProps } from './QueryErrorState.types';

export const QueryErrorState = (props: IQueryErrorStateProps) => {
  const { title, description, details, onRetry, isRetrying = false } = props;

  return (
    <section
      role="alert"
      className="app-shell-error rounded-2xl border border-[var(--red-bg)] bg-[var(--red-bg)] p-5 text-left"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-[var(--danger-strong)]"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--text-h)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--dim)]">{description}</p>
          {details ? <p className="mt-2 text-xs leading-5 text-[var(--dim)]">{details}</p> : null}
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border2)] bg-[var(--surface)] px-3.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
          >
            <RotateCw aria-hidden="true" className={`size-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying…' : 'Try again'}
          </button>
        </div>
      </div>
    </section>
  );
};
