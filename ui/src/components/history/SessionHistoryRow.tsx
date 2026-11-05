import { ChevronDown, ChevronRight } from 'lucide-react';

import type { ITheoryAnswer } from '@/core';
import { formatDate } from '@/utils';
import type { ISessionHistoryRowProps } from './SessionHistoryRow.types';

const MILLISECONDS_PER_MINUTE = 60_000;

const formatScore = (answer: ITheoryAnswer) => {
  if (answer.aiScore === null) return 'No score returned';
  return `Score: ${answer.aiScore} / 10`;
};

const formatSessionDuration = (startedAt: string, completedAt: string | null) => {
  if (!completedAt) return '—';

  const durationInMilliseconds = Date.parse(completedAt) - Date.parse(startedAt);
  if (!Number.isFinite(durationInMilliseconds) || durationInMilliseconds < 0) return '—';

  const totalMinutes = Math.floor(durationInMilliseconds / MILLISECONDS_PER_MINUTE);
  if (totalMinutes === 0) return '<1 min';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${totalMinutes} min`;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
};

const answerStatusLabel = (answer: ITheoryAnswer) => {
  switch (answer.status) {
    case 'queued':
      return 'Evaluation queued';
    case 'running':
      return 'Evaluation in progress';
    case 'completed':
      return 'Evaluation complete';
    case 'failed':
      return 'Evaluation failed';
  }
};

export const SessionHistoryRow = (props: ISessionHistoryRowProps) => {
  const { session, isExpanded, detail, isDetailLoading, detailError, onToggle, onRetry } = props;
  const detailsId = `session-details-${session.id}`;
  const dateLabel = formatDate(session.startedAt);
  const averageScore =
    session.questionsAnswered === 0 ? 'Not scored' : `${session.avgScore.toFixed(1)} / 10`;
  const modeLabel =
    session.mode === 'weak'
      ? 'Weak areas'
      : session.mode === 'pdf'
        ? 'PDF study'
        : 'Topic practice';
  const topicLabel = session.topicId ?? '—';

  return (
    <>
      <tr className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface)]">
        <td className="px-3 py-3 text-sm sm:px-4">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${dateLabel}`}
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
        <td className="px-3 py-3 text-sm text-[var(--text)] sm:px-4">{modeLabel}</td>
        <td className="max-w-44 truncate px-3 py-3 text-sm text-[var(--text)] sm:px-4">
          {topicLabel}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums text-[var(--text)] sm:px-4">
          {session.questionsAnswered} / {session.totalQuestions}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums text-[var(--text)] sm:px-4">
          {averageScore}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm text-[var(--text)] sm:px-4">
          {formatSessionDuration(session.startedAt, session.completedAt)}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm text-[var(--text)] sm:px-4">
          {session.status === 'completed' && session.completedAt ? 'Completed' : 'In progress'}
        </td>
      </tr>
      <tr id={detailsId} hidden={!isExpanded}>
        <td colSpan={7} className="border-b border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
          <div role="region" aria-label={`Session answers from ${dateLabel}`} className="space-y-3">
            {isDetailLoading ? (
              <p role="status" className="text-sm text-[var(--dim)]">
                Loading saved answers…
              </p>
            ) : detailError ? (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[var(--danger-strong)]">{detailError}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="min-h-9 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  Retry session details
                </button>
              </div>
            ) : detail?.answers.length ? (
              detail.answers.map((answer, index) => (
                <article
                  key={answer.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text-h)]">
                      Question {index + 1}
                    </h3>
                    <span className="text-xs text-[var(--dim)]">{answerStatusLabel(answer)}</span>
                  </div>
                  <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-[var(--text)]">
                    {answer.questionText}
                  </p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[var(--dim)]">
                    Your answer
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">
                    {answer.userAnswer}
                  </p>
                  {answer.status === 'completed' ? (
                    <p className="mt-3 text-sm font-medium text-[var(--accent-strong)]">
                      {formatScore(answer)}
                    </p>
                  ) : null}
                  {answer.aiFeedback ? (
                    <p className="mt-2 break-words rounded-md bg-[var(--accent-bg)] p-3 text-sm leading-6 text-[var(--accent-strong)]">
                      {answer.aiFeedback}
                    </p>
                  ) : null}
                  {answer.status === 'failed' && answer.failureMessage ? (
                    <p className="mt-2 text-sm leading-6 text-[var(--danger-strong)]">
                      {answer.failureMessage}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-sm text-[var(--dim)]">No saved answers for this session.</p>
            )}
          </div>
        </td>
      </tr>
    </>
  );
};
