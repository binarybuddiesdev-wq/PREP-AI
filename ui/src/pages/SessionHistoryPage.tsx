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
import { getApiErrorMessage } from '@/utils/apiErrorMessage';
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
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[1.35rem] font-bold text-[var(--text-h)]">Session History</h1>
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
          className={`min-h-9 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
            activeTab === 'practice'
              ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
              : 'border-[var(--border2)] text-[var(--dim)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
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
          className={`min-h-9 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
            activeTab === 'coding'
              ? 'border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-strong)]'
              : 'border-[var(--border2)] text-[var(--dim)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
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
          errorMessage={
            historyQuery.isError
              ? getApiErrorMessage(historyQuery.error, 'load your practice session history')
              : null
          }
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
                  ? getApiErrorMessage(detailQuery.error, 'load this practice session')
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
          errorMessage={
            codingHistoryQuery.isError
              ? getApiErrorMessage(codingHistoryQuery.error, 'load your coding session history')
              : null
          }
          problemTitleErrorMessage={
            codingProblemsQuery.isError
              ? getApiErrorMessage(codingProblemsQuery.error, 'load coding problem titles')
              : null
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
                  ? getApiErrorMessage(codingDetailQuery.error, 'load this coding session')
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
