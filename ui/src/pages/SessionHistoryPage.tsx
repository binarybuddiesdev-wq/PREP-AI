import { useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';

import {
  CodingSessionHistoryRow,
  CodingSessionHistoryTable,
  ExportCodingSessionHistoryButton,
  ExportSessionHistoryButton,
  SessionHistoryRow,
  SessionHistoryTable,
} from '@/components/history';
import { ROUTES } from '@/core';
import {
  useCodingProblemsReader,
  useCodingSessionDetailReader,
  useCodingSessionHistoryReader,
  useTheorySessionDetailReader,
  useTheorySessionHistoryReader,
} from '@/logic';

const HISTORY_PAGE_SIZE = 20;

export const SessionHistoryPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'practice' | 'coding'>('practice');
  const practiceTabRef = useRef<HTMLButtonElement>(null);
  const codingTabRef = useRef<HTMLButtonElement>(null);
  const [practicePage, setPracticePage] = useState(1);
  const [codingPage, setCodingPage] = useState(1);
  const [expandedPracticeSessionId, setExpandedPracticeSessionId] = useState<string | null>(null);
  const [expandedCodingSessionId, setExpandedCodingSessionId] = useState<string | null>(null);
  const historyQuery = useTheorySessionHistoryReader({
    page: practicePage,
    limit: HISTORY_PAGE_SIZE,
  });
  const detailQuery = useTheorySessionDetailReader(expandedPracticeSessionId ?? '');
  const isCodingTabActive = activeTab === 'coding';
  const codingHistoryQuery = useCodingSessionHistoryReader(
    { page: codingPage, limit: HISTORY_PAGE_SIZE },
    isCodingTabActive
  );
  const codingDetailQuery = useCodingSessionDetailReader(
    isCodingTabActive ? (expandedCodingSessionId ?? '') : ''
  );
  const codingProblemsQuery = useCodingProblemsReader(isCodingTabActive);
  const problemTitles = new Map(
    (codingProblemsQuery.data ?? []).map((problem) => [problem.id, problem.title])
  );

  const handleToggleSession = (sessionId: string) => {
    setExpandedPracticeSessionId((currentSessionId) =>
      currentSessionId === sessionId ? null : sessionId
    );
  };

  const handlePracticePageChange = (nextPage: number) => {
    setExpandedPracticeSessionId(null);
    setPracticePage(nextPage);
  };

  const handleCodingPageChange = (nextPage: number) => {
    setExpandedCodingSessionId(null);
    setCodingPage(nextPage);
  };

  const handleToggleCodingSession = (sessionId: string) => {
    setExpandedCodingSessionId((currentSessionId) =>
      currentSessionId === sessionId ? null : sessionId
    );
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: 'practice' | 'coding'
  ) => {
    let nextTab: 'practice' | 'coding' | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      nextTab = currentTab === 'practice' ? 'coding' : 'practice';
    } else if (event.key === 'Home') {
      nextTab = 'practice';
    } else if (event.key === 'End') {
      nextTab = 'coding';
    }

    if (!nextTab) return;

    event.preventDefault();
    setActiveTab(nextTab);
    (nextTab === 'practice' ? practiceTabRef : codingTabRef).current?.focus();
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-h)]">Session History</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Review your practice sessions, coding attempts, and saved feedback.
          </p>
        </div>
        {activeTab === 'practice' ? (
          <ExportSessionHistoryButton
            sessions={historyQuery.isError ? [] : (historyQuery.data?.sessions ?? [])}
            page={practicePage}
          />
        ) : (
          <ExportCodingSessionHistoryButton
            sessions={codingHistoryQuery.isError ? [] : (codingHistoryQuery.data?.sessions ?? [])}
            page={codingPage}
          />
        )}
      </header>
      <div role="tablist" aria-label="Session history type" className="flex gap-2">
        <button
          ref={practiceTabRef}
          type="button"
          role="tab"
          id="practice-history-tab"
          aria-selected={activeTab === 'practice'}
          aria-controls="practice-history-panel"
          tabIndex={activeTab === 'practice' ? 0 : -1}
          onClick={() => setActiveTab('practice')}
          onKeyDown={(event) => handleTabKeyDown(event, 'practice')}
          className={`min-h-9 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            activeTab === 'practice'
              ? 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200'
              : 'border-white/10 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
        >
          Practice
        </button>
        <button
          ref={codingTabRef}
          type="button"
          role="tab"
          id="coding-history-tab"
          aria-selected={activeTab === 'coding'}
          aria-controls="coding-history-panel"
          tabIndex={activeTab === 'coding' ? 0 : -1}
          onClick={() => setActiveTab('coding')}
          onKeyDown={(event) => handleTabKeyDown(event, 'coding')}
          className={`min-h-9 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
            activeTab === 'coding'
              ? 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200'
              : 'border-white/10 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
          }`}
        >
          Coding
        </button>
      </div>
      <section
        role="tabpanel"
        id="practice-history-panel"
        aria-labelledby="practice-history-tab"
        hidden={activeTab !== 'practice'}
      >
        <SessionHistoryTable
          hasSessions={Boolean(historyQuery.data?.sessions.length)}
          page={practicePage}
          limit={historyQuery.data?.limit ?? HISTORY_PAGE_SIZE}
          total={historyQuery.data?.total ?? 0}
          isLoading={historyQuery.isPending && !historyQuery.data}
          errorMessage={historyQuery.isError ? historyQuery.error.message : null}
          onRetryHistory={() => void historyQuery.refetch()}
          onPageChange={handlePracticePageChange}
          onStartPractice={() => navigate(ROUTES.practice)}
        >
          {(historyQuery.data?.sessions ?? []).map((session) => (
            <SessionHistoryRow
              key={session.id}
              session={session}
              isExpanded={expandedPracticeSessionId === session.id}
              detail={expandedPracticeSessionId === session.id ? detailQuery.data : undefined}
              isDetailLoading={expandedPracticeSessionId === session.id && detailQuery.isPending}
              detailError={
                expandedPracticeSessionId === session.id && detailQuery.isError
                  ? detailQuery.error.message
                  : null
              }
              onToggle={handleToggleSession}
              onRetry={() => void detailQuery.refetch()}
            />
          ))}
        </SessionHistoryTable>
      </section>
      <section
        role="tabpanel"
        id="coding-history-panel"
        aria-labelledby="coding-history-tab"
        hidden={activeTab !== 'coding'}
      >
        <CodingSessionHistoryTable
          hasSessions={Boolean(codingHistoryQuery.data?.sessions.length)}
          page={codingPage}
          limit={codingHistoryQuery.data?.limit ?? HISTORY_PAGE_SIZE}
          total={codingHistoryQuery.data?.total ?? 0}
          isLoading={codingHistoryQuery.isPending && !codingHistoryQuery.data}
          errorMessage={codingHistoryQuery.isError ? codingHistoryQuery.error.message : null}
          problemTitleErrorMessage={
            codingProblemsQuery.isError ? codingProblemsQuery.error.message : null
          }
          onRetryHistory={() => void codingHistoryQuery.refetch()}
          onRetryProblemTitles={() => void codingProblemsQuery.refetch()}
          onPageChange={handleCodingPageChange}
          onStartCoding={() => navigate(ROUTES.coding)}
        >
          {(codingHistoryQuery.data?.sessions ?? []).map((session) => (
            <CodingSessionHistoryRow
              key={session.id}
              session={session}
              problemTitles={problemTitles}
              isExpanded={expandedCodingSessionId === session.id}
              detail={expandedCodingSessionId === session.id ? codingDetailQuery.data : undefined}
              isDetailLoading={
                expandedCodingSessionId === session.id && codingDetailQuery.isPending
              }
              detailError={
                expandedCodingSessionId === session.id && codingDetailQuery.isError
                  ? codingDetailQuery.error.message
                  : null
              }
              onToggle={handleToggleCodingSession}
              onRetry={() => void codingDetailQuery.refetch()}
            />
          ))}
        </CodingSessionHistoryTable>
      </section>
    </main>
  );
};
