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
      <tr className="border-b border-white/[0.06] transition-colors hover:bg-white/[0.025]">
        <td className="px-3 py-3 text-sm sm:px-4">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${dateLabel}`}
            onClick={() => onToggle(session.id)}
            className="inline-flex min-h-9 items-center gap-2 rounded-md text-left text-zinc-200 transition hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            {isExpanded ? (
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-amber-300" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-zinc-500" />
            )}
            <time dateTime={session.startedAt}>{dateLabel}</time>
          </button>
        </td>
        <td className="px-3 py-3 text-sm text-zinc-300 sm:px-4">{modeLabel}</td>
        <td className="max-w-44 truncate px-3 py-3 text-sm text-zinc-300 sm:px-4">{topicLabel}</td>
        <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums text-zinc-300 sm:px-4">
          {session.questionsAnswered} / {session.totalQuestions}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums text-zinc-300 sm:px-4">
          {averageScore}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-300 sm:px-4">
          {formatSessionDuration(session.startedAt, session.completedAt)}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-300 sm:px-4">
          {session.status === 'completed' && session.completedAt ? 'Completed' : 'In progress'}
        </td>
      </tr>
      <tr id={detailsId} hidden={!isExpanded}>
        <td colSpan={7} className="border-b border-white/[0.06] bg-white/[0.015] p-3 sm:p-4">
          <div role="region" aria-label={`Session answers from ${dateLabel}`} className="space-y-3">
            {isDetailLoading ? (
              <p role="status" className="text-sm text-zinc-400">
                Loading saved answers…
              </p>
            ) : detailError ? (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-rose-300">{detailError}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  Retry session details
                </button>
              </div>
            ) : detail?.answers.length ? (
              detail.answers.map((answer, index) => (
                <article
                  key={answer.id}
                  className="rounded-lg border border-white/[0.07] bg-[#111113] p-3 sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-zinc-100">Question {index + 1}</h3>
                    <span className="text-xs text-zinc-400">{answerStatusLabel(answer)}</span>
                  </div>
                  <p className="mt-2 break-words whitespace-pre-wrap text-sm leading-6 text-zinc-200">
                    {answer.questionText}
                  </p>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Your answer
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
                    {answer.userAnswer}
                  </p>
                  {answer.status === 'completed' ? (
                    <p className="mt-3 text-sm font-medium text-amber-200">{formatScore(answer)}</p>
                  ) : null}
                  {answer.aiFeedback ? (
                    <p className="mt-2 break-words rounded-md bg-amber-400/[0.08] p-3 text-sm leading-6 text-amber-100">
                      {answer.aiFeedback}
                    </p>
                  ) : null}
                  {answer.status === 'failed' && answer.failureMessage ? (
                    <p className="mt-2 text-sm leading-6 text-rose-300">{answer.failureMessage}</p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="text-sm text-zinc-400">No saved answers for this session.</p>
            )}
          </div>
        </td>
      </tr>
    </>
  );
};
