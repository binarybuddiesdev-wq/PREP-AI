import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import {
  PracticeSetup,
  TheoryFeedback,
  TheoryQuestionCard,
  TheorySessionComplete,
  type PracticeMode,
} from '@/components/practice';
import { LoadingScreen, QueryErrorState } from '@/components/layout';
import { ROUTES, type IStartTheorySessionBody, type TheoryDifficulty } from '@/core';
import {
  getHttpStatus,
  getPracticePolicy,
  usePdfSourcesReader,
  useSessionReader,
  useTheoryPracticeReader,
  useTheoryPracticeSession,
  useTheoryStatsReader,
  useUserReader,
} from '@/logic';

export const PracticePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTopicId = searchParams.get('topicId');
  const { isLoaded } = useSessionReader();
  const userQuery = useUserReader();
  const { topicsQuery, weakAreasQuery } = useTheoryPracticeReader();
  const pdfSourcesQuery = usePdfSourcesReader();
  const practice = useTheoryPracticeSession();
  const theoryStatsQuery = useTheoryStatsReader(!practice.session && !practice.completedSession);
  const isTheoryStatsAuthExpired =
    theoryStatsQuery.isError && getHttpStatus(theoryStatsQuery.error) === 401;
  const [mode, setMode] = useState<PracticeMode>('topic');
  const [topicId, setTopicId] = useState('');
  const [difficulty, setDifficulty] = useState<TheoryDifficulty>('Mid');
  const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([]);

  useEffect(() => {
    if (!requestedTopicId || !topicsQuery.data?.some((topic) => topic.id === requestedTopicId)) {
      return;
    }
    setTopicId(requestedTopicId);
  }, [requestedTopicId, topicsQuery.data]);

  useEffect(() => {
    if (!pdfSourcesQuery.data) return;
    const readyIds = new Set(
      pdfSourcesQuery.data.filter((source) => source.status === 'ready').map((source) => source.id)
    );
    setSelectedPdfIds((current) => {
      const next = current.filter((id) => readyIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [pdfSourcesQuery.data]);

  if (!isLoaded || userQuery.isPending) {
    return <LoadingScreen label="Loading practice setup…" layout="embedded" />;
  }

  const profileUnavailable = userQuery.isError || !userQuery.data;
  const { isPremium, totalQuestions } = getPracticePolicy(userQuery.data?.role ?? 'USER');

  const createSessionBody = (): IStartTheorySessionBody => ({
    ...(mode === 'topic' ? { topicId } : {}),
    ...(mode === 'pdf' ? { pdfIds: selectedPdfIds } : {}),
    mode,
    difficulty,
    totalQuestions,
  });
  const handleStart = () => void practice.start(createSessionBody());
  const handlePracticeSameTopic = () => void practice.restart(createSessionBody());

  if (practice.completedSession) {
    return (
      <TheorySessionComplete
        session={practice.completedSession}
        answers={practice.savedAnswers}
        onPracticeAgain={practice.reset}
        onGoToDashboard={() => navigate(ROUTES.dashboard)}
      />
    );
  }

  if (practice.session) {
    if (practice.phase === 'loading') {
      return (
        <LoadingScreen
          label={
            practice.session.mode === 'pdf'
              ? 'Preparing questions from your PDFs…'
              : 'Loading your questions…'
          }
          layout="embedded"
        />
      );
    }

    if (practice.phase === 'error') {
      if (practice.session.mode === 'pdf') {
        return (
          <main className="mx-auto w-full max-w-3xl rounded-xl border border-[var(--red-bg)] bg-[var(--red-bg)] p-5 sm:p-6">
            <h1 className="text-lg font-semibold text-[var(--text-h)]">
              PDF questions could not be prepared
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--dim)]">
              Check the error details, retry question generation, or end this session and choose
              another source.
            </p>
            {practice.questionsQuery.error?.message ? (
              <p className="mt-3 break-words rounded-lg bg-[var(--surface)] p-3 text-xs leading-5 text-[var(--danger-strong)]">
                {practice.questionsQuery.error.message}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={practice.questionsQuery.isFetching}
                onClick={() => void practice.questionsQuery.refetch()}
                className="min-h-10 rounded-lg border border-[var(--border2)] px-4 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
              >
                {practice.questionsQuery.isFetching ? 'Retrying…' : 'Retry questions'}
              </button>
              <button
                type="button"
                disabled={practice.isCompleting}
                onClick={() => void practice.end()}
                className="min-h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-zinc-950 transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
              >
                {practice.isCompleting ? 'Ending session…' : 'End session'}
              </button>
            </div>
          </main>
        );
      }
      return (
        <main className="mx-auto w-full max-w-3xl">
          <QueryErrorState
            title="Couldn’t load your questions"
            description="Your session is saved, but its questions could not be loaded. Try again to continue."
            details={practice.questionsQuery.error?.message}
            onRetry={() => void practice.questionsQuery.refetch()}
            isRetrying={practice.questionsQuery.isFetching}
          />
        </main>
      );
    }

    if (practice.phase === 'empty') {
      return (
        <main className="mx-auto w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6">
          <h1 className="mb-2 text-xl font-semibold text-[var(--text-h)]">
            No questions available
          </h1>
          <p className="text-sm leading-6 text-[var(--dim)]">
            The server returned no questions for this session. End it and choose a different topic.
          </p>
          <button
            type="button"
            onClick={practice.end}
            className="mt-4 min-h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-zinc-950 transition hover:bg-[var(--accent2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            End session
          </button>
        </main>
      );
    }

    if (practice.phase === 'complete') {
      return (
        <main className="mx-auto w-full max-w-3xl">
          <section
            role="alert"
            className="rounded-xl border border-[var(--red-bg)] bg-[var(--red-bg)] p-5"
          >
            <h1 className="text-lg font-semibold text-[var(--text-h)]">
              Session completion needs attention
            </h1>
            <p className="mt-1 text-sm text-[var(--danger-strong)]">
              {practice.completionError || 'The session could not be completed.'}
            </p>
            <button
              type="button"
              disabled={practice.isCompleting}
              onClick={practice.retryCompletion}
              className="mt-4 min-h-10 rounded-lg border border-[var(--border2)] px-4 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
            >
              {practice.isCompleting ? 'Completing…' : 'Retry completion'}
            </button>
          </section>
        </main>
      );
    }

    if (!practice.activeQuestion) return null;

    return (
      <main className="mx-auto w-full max-w-4xl">
        <TheoryQuestionCard
          question={practice.activeQuestion}
          currentQuestion={practice.progress.current}
          totalQuestions={practice.progress.total}
          elapsedSeconds={practice.elapsedSeconds}
          answerDraft={practice.answerDraft}
          isSubmitting={practice.isSubmitting}
          isAnswerFrozen={practice.isAnswerFrozen}
          submitError={practice.submitError}
          submitted={practice.phase === 'submitted'}
          onAnswerChange={practice.setAnswerDraft}
          onSubmit={() => void practice.submit()}
          onSkip={practice.skip}
          onEnd={practice.end}
        />
        {practice.phase === 'submitted' && practice.evaluation ? (
          <TheoryFeedback
            answer={practice.evaluation}
            evaluationError={
              practice.evaluationQuery.isError ? practice.evaluationQuery.error.message : null
            }
            isRefreshing={practice.evaluationQuery.isFetching}
            isEnding={practice.isEnding}
            isCompleting={practice.isCompleting}
            isRestarting={practice.isRestarting}
            canContinue={practice.canContinue}
            onRetryEvaluation={() => void practice.evaluationQuery.refetch()}
            onContinue={practice.continueAfterSubmit}
            onPracticeSameTopic={handlePracticeSameTopic}
            onEnd={() => void practice.end()}
          />
        ) : null}
        {practice.completionError ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-[var(--red-bg)] bg-[var(--red-bg)] p-3 text-sm text-[var(--danger-strong)]"
          >
            <p>{practice.completionError}</p>
            <button
              type="button"
              disabled={practice.isCompleting || practice.isRestarting}
              onClick={() =>
                practice.canRetryRestart ? practice.retryRestart() : practice.retryCompletion()
              }
              className="mt-2 min-h-9 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
            >
              {practice.isRestarting
                ? 'Starting again…'
                : practice.isCompleting
                  ? 'Completing…'
                  : practice.canRetryRestart
                    ? 'Retry same-topic restart'
                    : 'Retry session completion'}
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {profileUnavailable ? (
        <section
          role="alert"
          className="rounded-xl border border-[var(--red-bg)] bg-[var(--red-bg)] p-4 sm:p-5"
        >
          <h2 className="text-sm font-semibold text-[var(--text-h)]">
            Profile details unavailable
          </h2>
          <p className="mt-1 text-sm leading-5 text-[var(--dim)]">
            Practice setup remains available with the free-plan limit of {totalQuestions} questions.
            Retry your profile to load your account limits. Server limits still apply.
          </p>
          {userQuery.error?.message ? (
            <p className="mt-2 break-words text-xs text-[var(--danger-strong)]">
              {userQuery.error.message}
            </p>
          ) : null}
          <button
            type="button"
            disabled={userQuery.isFetching}
            onClick={() => void userQuery.refetch()}
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border2)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface2)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] disabled:opacity-60"
          >
            {userQuery.isFetching ? 'Retrying...' : 'Retry profile'}
          </button>
        </section>
      ) : null}
      <PracticeSetup
        mode={mode}
        topicId={topicId}
        difficulty={difficulty}
        totalQuestions={totalQuestions}
        isPremium={isPremium}
        dailySessions={theoryStatsQuery.data?.dailySessions ?? null}
        isDailySessionsLoading={theoryStatsQuery.isPending}
        isDailySessionsFetching={theoryStatsQuery.isFetching}
        dailySessionsError={
          theoryStatsQuery.isError
            ? isTheoryStatsAuthExpired
              ? 'Your session has expired. Refresh the page and sign in again.'
              : (theoryStatsQuery.error?.message ?? 'Practice usage could not be loaded.')
            : null
        }
        onRetryDailySessions={
          isTheoryStatsAuthExpired ? null : () => void theoryStatsQuery.refetch()
        }
        topics={topicsQuery.data ?? []}
        weakAreas={weakAreasQuery.data ?? []}
        pdfSources={pdfSourcesQuery.data ?? []}
        selectedPdfIds={selectedPdfIds}
        isPdfSourcesLoading={pdfSourcesQuery.isPending}
        pdfSourcesError={pdfSourcesQuery.isError ? pdfSourcesQuery.error.message : null}
        onRetryPdfSources={() => void pdfSourcesQuery.refetch()}
        onPdfSelectionChange={setSelectedPdfIds}
        onManageDocuments={() => navigate(ROUTES.settingsDocuments)}
        isTopicsLoading={topicsQuery.isPending}
        topicsError={topicsQuery.isError ? topicsQuery.error.message : null}
        onRetryTopics={() => void topicsQuery.refetch()}
        isWeakAreasLoading={weakAreasQuery.isPending}
        weakAreasError={weakAreasQuery.isError ? weakAreasQuery.error.message : null}
        onRetryWeakAreas={() => void weakAreasQuery.refetch()}
        isStarting={practice.isStarting}
        startError={practice.startError}
        onModeChange={setMode}
        onTopicChange={setTopicId}
        onDifficultyChange={setDifficulty}
        onStart={handleStart}
      />
    </div>
  );
};
