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
        className="rounded-xl border border-white/[0.08] bg-[#18181b] p-5"
      >
        <span className="sr-only">Loading coding session history…</span>
        <div aria-hidden="true" className="space-y-3 animate-pulse motion-reduce:animate-none">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="grid grid-cols-5 gap-3 py-2">
              <div className="h-4 w-24 rounded bg-white/[0.07]" />
              <div className="h-4 w-12 rounded bg-white/[0.07]" />
              <div className="h-4 w-10 rounded bg-white/[0.07]" />
              <div className="h-4 w-16 rounded bg-white/[0.07]" />
              <div className="h-4 w-20 rounded bg-white/[0.07]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <section role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Couldn’t load coding history</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-300">{errorMessage}</p>
        <button
          type="button"
          onClick={onRetryHistory}
          className="mt-3 min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-100 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        >
          Retry coding history
        </button>
      </section>
    );
  }

  if (!hasSessions) {
    return (
      <section className="rounded-xl border border-white/[0.08] bg-[#18181b] px-5 py-10 text-center sm:px-8">
        <h2 className="text-lg font-semibold text-zinc-100">No coding sessions yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
          Your coding sessions and saved submissions will appear here after you practice.
        </p>
        <button
          type="button"
          onClick={onStartCoding}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
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
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3"
        >
          <p className="text-sm text-amber-100">
            Problem titles could not be loaded. Showing problem IDs instead.{' '}
            {problemTitleErrorMessage}
          </p>
          <button
            type="button"
            onClick={onRetryProblemTitles}
            className="min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-100 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            Retry problem titles
          </button>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#18181b]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] border-collapse text-left">
            <caption className="sr-only">Coding session history</caption>
            <thead className="bg-white/[0.025]">
              <tr>
                {tableHeaders.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="border-b border-white/[0.08] px-3 py-3 text-[0.68rem] font-medium uppercase tracking-[0.08em] text-zinc-500 sm:px-4"
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
        <p className="text-sm text-zinc-400">
          Page {page} of {totalPages}
          <span className="hidden sm:inline"> · {total} coding sessions</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </nav>
    </section>
  );
};
