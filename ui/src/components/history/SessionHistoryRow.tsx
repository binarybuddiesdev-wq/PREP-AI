import { Check, ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';

import type { ITheoryAnswer } from '@/core';
import { formatDate } from '@/utils';
import type { ISessionHistoryRowProps } from './SessionHistoryRow.types';

const MILLISECONDS_PER_MINUTE = 60_000;

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
  const hasScore = session.questionsAnswered > 0;
  const scoreValue = hasScore ? session.avgScore.toFixed(1) : null;
  const averageScore = scoreValue ? `${scoreValue} / 10` : 'Not scored';
  const scoreTone = !hasScore
    ? 'bg-[var(--surface2)] text-[var(--dim)]'
    : session.avgScore >= 7
      ? 'bg-[var(--green-bg)] text-[var(--success-strong)]'
      : session.avgScore >= 5
        ? 'bg-[var(--accent-bg)] text-[var(--accent-strong)]'
        : 'bg-[var(--red-bg)] text-[var(--danger-strong)]';
  const scoreIndicator = !hasScore
    ? null
    : session.avgScore >= 7
      ? 'check'
      : session.avgScore >= 5
        ? '~'
        : '!';
  const topicLabel = session.topicId ?? '—';

  return (
    <>
      <tr className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface)]">
        <td className="px-4 py-[0.7rem] text-[0.825rem]">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${dateLabel}`}
            onClick={() => onToggle(session.id)}
            className="inline-flex min-h-6 items-center gap-2 rounded-md text-left text-[var(--text)] transition hover:text-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
        <td className="px-4 py-[0.7rem] text-[0.825rem]">
          <span className="inline-flex rounded-full bg-[var(--blue-bg)] px-[0.6rem] py-[0.2rem] text-[0.72rem] font-semibold text-[var(--info-strong)]">
            Practice
          </span>
        </td>
        <td className="max-w-44 truncate px-4 py-[0.7rem] text-[0.825rem] text-[var(--text)]">
          {topicLabel}
        </td>
        <td className="whitespace-nowrap px-4 py-[0.7rem] text-[0.825rem] tabular-nums text-[var(--text)]">
          {session.questionsAnswered} / {session.totalQuestions}
        </td>
        <td className="whitespace-nowrap px-4 py-[0.7rem] text-[0.825rem] tabular-nums">
          <span
            aria-label={hasScore ? `Average score: ${averageScore}` : averageScore}
            className={`inline-flex items-center gap-1 rounded-full px-[0.6rem] py-[0.2rem] text-[0.72rem] font-semibold ${scoreTone}`}
          >
            {scoreIndicator === 'check' ? (
              <Check aria-hidden="true" className="size-3" />
            ) : scoreIndicator ? (
              <span aria-hidden="true">{scoreIndicator}</span>
            ) : null}
            {scoreValue ?? averageScore}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-[0.7rem] text-[0.825rem] text-[var(--text)]">
          {formatSessionDuration(session.startedAt, session.completedAt)}
        </td>
        <td className="whitespace-nowrap px-4 py-[0.7rem] text-[0.825rem]">
          <span
            className={`inline-flex rounded-full px-[0.6rem] py-[0.2rem] text-[0.72rem] font-semibold ${
              session.status === 'completed' && session.completedAt
                ? 'bg-[var(--green-bg)] text-[var(--success-strong)]'
                : 'bg-[var(--blue-bg)] text-[var(--info-strong)]'
            }`}
          >
            {session.status === 'completed' && session.completedAt ? 'Completed' : 'In Progress'}
          </span>
        </td>
      </tr>
      <tr id={detailsId} hidden={!isExpanded}>
        <td
          colSpan={7}
          className="border-b border-[var(--border)] bg-[var(--bg2)] px-4 py-[0.7rem]"
        >
          <div className="bg-[var(--bg2)] p-[1.2rem]">
            <div
              role="region"
              aria-label={`Session answers from ${dateLabel}`}
              className="space-y-3"
            >
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
                detail.answers.map((answer) => (
                  <article
                    key={answer.id}
                    className="mb-2.5 flex flex-col gap-[0.35rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 last:mb-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="break-words text-[0.85rem] font-semibold text-[var(--text-h)]">
                        Q: {answer.questionText}
                      </h3>
                      <span className="text-xs text-[var(--dim)]">
                        {answerStatusLabel(answer)}
                        {answer.aiScore === null ? '' : ` · Score: ${answer.aiScore} / 10`}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-[0.825rem] leading-[1.6] text-[var(--dim)]">
                      A: {answer.userAnswer}
                    </p>
                    {answer.aiFeedback ? (
                      <p className="mt-[0.15rem] flex items-start gap-2 break-words rounded-md bg-[var(--accent-bg)] px-3 py-2 text-[0.78rem] leading-[1.5] text-[var(--accent-strong)]">
                        <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
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
          </div>
        </td>
      </tr>
    </>
  );
};
