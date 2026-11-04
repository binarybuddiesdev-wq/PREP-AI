import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  ExportSessionHistoryButton,
  SessionHistoryRow,
  SessionHistoryTable,
} from '@/components/history';
import { ROUTES } from '@/core';
import { useTheorySessionDetailReader, useTheorySessionHistoryReader } from '@/logic';

const HISTORY_PAGE_SIZE = 20;

export const SessionHistoryPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const historyQuery = useTheorySessionHistoryReader({ page, limit: HISTORY_PAGE_SIZE });
  const detailQuery = useTheorySessionDetailReader(expandedSessionId ?? '');

  const handleToggleSession = (sessionId: string) => {
    setExpandedSessionId((currentSessionId) => (currentSessionId === sessionId ? null : sessionId));
  };

  const handlePageChange = (nextPage: number) => {
    setExpandedSessionId(null);
    setPage(nextPage);
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-h)]">Session History</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Review your practice sessions and the answers you saved.
          </p>
        </div>
        <ExportSessionHistoryButton
          sessions={historyQuery.isError ? [] : (historyQuery.data?.sessions ?? [])}
          page={page}
        />
      </header>
      <SessionHistoryTable
        hasSessions={Boolean(historyQuery.data?.sessions.length)}
        page={page}
        limit={historyQuery.data?.limit ?? HISTORY_PAGE_SIZE}
        total={historyQuery.data?.total ?? 0}
        isLoading={historyQuery.isPending && !historyQuery.data}
        errorMessage={historyQuery.isError ? historyQuery.error.message : null}
        onRetryHistory={() => void historyQuery.refetch()}
        onPageChange={handlePageChange}
        onStartPractice={() => navigate(ROUTES.practice)}
      >
        {(historyQuery.data?.sessions ?? []).map((session) => (
          <SessionHistoryRow
            key={session.id}
            session={session}
            isExpanded={expandedSessionId === session.id}
            detail={expandedSessionId === session.id ? detailQuery.data : undefined}
            isDetailLoading={expandedSessionId === session.id && detailQuery.isPending}
            detailError={
              expandedSessionId === session.id && detailQuery.isError
                ? detailQuery.error.message
                : null
            }
            onToggle={handleToggleSession}
            onRetry={() => void detailQuery.refetch()}
          />
        ))}
      </SessionHistoryTable>
    </main>
  );
};
