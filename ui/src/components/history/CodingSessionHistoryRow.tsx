import { ChevronDown, ChevronRight } from 'lucide-react';

import { formatDate } from '@/utils';
import { CodingSubmissionDetail } from './CodingSubmissionDetail';
import type { ICodingSessionHistoryRowProps } from './CodingSessionHistoryRow.types';

const MILLISECONDS_PER_MINUTE = 60_000;

const formatSessionDuration = (startedAt: string, completedAt: string | null) => {
  if (!completedAt) return '—';
  const duration = Date.parse(completedAt) - Date.parse(startedAt);
  if (!Number.isFinite(duration) || duration < 0) return '—';

  const minutes = Math.floor(duration / MILLISECONDS_PER_MINUTE);
  if (minutes === 0) return '<1 min';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return remainingMinutes === 0 ? `${hours} hr` : `${hours} hr ${remainingMinutes} min`;
};

export const CodingSessionHistoryRow = (props: ICodingSessionHistoryRowProps) => {
  const {
    session,
    problemTitles,
    isExpanded,
    detail,
    isDetailLoading,
    detailError,
    onToggle,
    onRetry,
  } = props;
  const detailsId = `coding-session-details-${session.id}`;
  const dateLabel = formatDate(session.startedAt);

  return (
    <>
      <tr className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface)]">
        <td className="px-3 py-3 text-sm sm:px-4">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            aria-label={`${isExpanded ? 'Hide' : 'Show'} submissions for ${dateLabel}`}
            onClick={() => onToggle(session.id)}
            className="inline-flex min-h-9 items-center gap-2 rounded-md text-left text-[var(--text)] transition hover:text-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {isExpanded ? (
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-[var(--accent-strong)]"
              />
            ) : (
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-[var(--dim)]" />
            )}
            <time dateTime={session.startedAt}>{dateLabel}</time>
          </button>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums text-[var(--text)] sm:px-4">
          {session.problemsAttempted}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums text-[var(--text)] sm:px-4">
          {session.problemsSolved}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm text-[var(--text)] sm:px-4">
          {formatSessionDuration(session.startedAt, session.completedAt)}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm text-[var(--text)] sm:px-4">
          {session.status === 'completed' && session.completedAt ? 'Completed' : 'In progress'}
        </td>
      </tr>
      <tr id={detailsId} hidden={!isExpanded}>
        <td colSpan={5} className="border-b border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
          <div
            role="region"
            aria-label={`Coding submissions from ${dateLabel}`}
            className="space-y-3"
          >
            {isDetailLoading ? (
              <div
                role="status"
                aria-label="Loading saved coding submissions"
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <span className="sr-only">Loading saved coding submissions…</span>
                <div
                  aria-hidden="true"
                  className="space-y-3 animate-pulse motion-reduce:animate-none"
                >
                  <div className="h-4 w-36 rounded bg-[var(--surface2)]" />
                  <div className="h-3 w-24 rounded bg-[var(--surface)]" />
                  <div className="h-20 rounded bg-[var(--surface)]" />
                </div>
              </div>
            ) : detailError ? (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--danger-strong)]">{detailError}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="min-h-9 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  Retry coding session details
                </button>
              </div>
            ) : detail?.answers.length ? (
              detail.answers.map((answer) => (
                <CodingSubmissionDetail
                  key={answer.id}
                  answer={answer}
                  problemTitle={
                    problemTitles.get(answer.problemId) ?? `Problem ID: ${answer.problemId}`
                  }
                />
              ))
            ) : (
              <p className="text-sm text-[var(--dim)]">No saved submissions in this session.</p>
            )}
          </div>
        </td>
      </tr>
    </>
  );
};
