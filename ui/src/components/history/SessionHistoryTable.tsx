import type { ISessionHistoryTableProps } from './SessionHistoryTable.types';

const tableHeaders = [
  'Date',
  'Type',
  'Topic',
  'Questions',
  'Avg. score',
  'Duration',
  'Status',
] as const;

export const SessionHistoryTable = (props: ISessionHistoryTableProps) => {
  const {
    hasSessions,
    children,
    page,
    limit,
    total,
    isLoading,
    errorMessage,
    onRetryHistory,
    onPageChange,
    onStartPractice,
  } = props;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (isLoading) {
    return (
      <div
        role="status"
        className="rounded-xl border border-white/[0.08] bg-[#18181b] p-6 text-sm text-zinc-400"
      >
        Loading session history…
      </div>
    );
  }

  if (errorMessage) {
    return (
      <section role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Couldn’t load session history</h2>
        <p className="mt-1 text-sm leading-6 text-zinc-300">{errorMessage}</p>
        <button
          type="button"
          onClick={onRetryHistory}
          className="mt-3 min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-100 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        >
          Retry history
        </button>
      </section>
    );
  }

  if (!hasSessions) {
    return (
      <section className="rounded-xl border border-white/[0.08] bg-[#18181b] px-5 py-10 text-center sm:px-8">
        <h2 className="text-lg font-semibold text-zinc-100">No sessions yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
          Start your first practice session to begin tracking your progress and improvement over
          time.
        </p>
        <button
          type="button"
          onClick={onStartPractice}
          className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        >
          Start practicing
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Session history" className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#18181b]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <caption className="sr-only">Your recent practice sessions</caption>
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
      <nav aria-label="Session history pages" className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          Page {page} of {totalPages}
          <span className="hidden sm:inline"> · {total} sessions</span>
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
