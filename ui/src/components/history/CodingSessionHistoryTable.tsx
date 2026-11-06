import type { ICodingSessionHistoryTableProps } from './CodingSessionHistoryTable.types';

const tableHeaders = ['Date', 'Problems attempted', 'Solved', 'Duration', 'Status'] as const;

export const CodingSessionHistoryTable = (props: ICodingSessionHistoryTableProps) => {
  const {
    hasSessions,
    children,
    page,
    limit,
    total,
    isLoading,
    errorMessage,
    problemTitleErrorMessage,
    onRetryHistory,
    onRetryProblemTitles,
    onPageChange,
    onStartCoding,
  } = props;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading coding session history"
        className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
      >
        <span className="sr-only">Loading coding session history…</span>
        <div aria-hidden="true" className="space-y-3 animate-pulse motion-reduce:animate-none">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="grid grid-cols-5 gap-3 py-2">
              <div className="h-4 w-24 rounded bg-[var(--surface2)]" />
              <div className="h-4 w-12 rounded bg-[var(--surface2)]" />
              <div className="h-4 w-10 rounded bg-[var(--surface2)]" />
              <div className="h-4 w-16 rounded bg-[var(--surface2)]" />
              <div className="h-4 w-20 rounded bg-[var(--surface2)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <section
        role="alert"
        className="rounded-xl border border-[var(--red-bg)] bg-[var(--red-bg)] p-5"
      >
        <h2 className="text-sm font-semibold text-[var(--text-h)]">Couldn’t load coding history</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--danger-strong)]">{errorMessage}</p>
        <button
          type="button"
          onClick={onRetryHistory}
          className="mt-3 min-h-9 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Retry coding history
        </button>
      </section>
    );
  }

  if (!hasSessions) {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-10 text-center sm:px-8">
        <h2 className="text-lg font-semibold text-[var(--text-h)]">No coding sessions yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--dim)]">
          Your coding sessions and saved submissions will appear here after you practice.
        </p>
        <button
          type="button"
          onClick={onStartCoding}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-zinc-950 transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Start coding practice
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Coding session history" className="space-y-3">
      {problemTitleErrorMessage ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-bg)] p-3"
        >
          <p className="text-sm text-[var(--accent-strong)]">
            Problem titles could not be loaded. Showing problem IDs instead.{' '}
            {problemTitleErrorMessage}
          </p>
          <button
            type="button"
            onClick={onRetryProblemTitles}
            className="min-h-9 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Retry problem titles
          </button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] border-collapse text-left">
            <caption className="sr-only">Coding session history</caption>
            <thead className="bg-[var(--surface)]">
              <tr>
                {tableHeaders.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="border-b border-[var(--border)] px-4 py-[0.7rem] text-[0.68rem] font-medium uppercase tracking-[0.08em] text-[var(--dim)]"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      </div>
      <nav aria-label="Coding history pages" className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--dim)]">
          Page {page} of {totalPages}
          <span className="hidden sm:inline"> · {total} coding sessions</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="min-h-9 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="min-h-9 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </nav>
    </section>
  );
};
