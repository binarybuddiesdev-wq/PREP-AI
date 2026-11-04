import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

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
  getPracticePolicy,
  usePdfSourcesReader,
  useSessionReader,
  useTheoryPracticeReader,
  useTheoryPracticeSession,
  useUserReader,
} from '@/logic';

export const PracticePage = () => {
  const navigate = useNavigate();
  const { isLoaded } = useSessionReader();
  const userQuery = useUserReader();
  const { topicsQuery, weakAreasQuery } = useTheoryPracticeReader();
  const pdfSourcesQuery = usePdfSourcesReader();
  const practice = useTheoryPracticeSession();
  const [mode, setMode] = useState<PracticeMode>('topic');
  const [topicId, setTopicId] = useState('');
  const [difficulty, setDifficulty] = useState<TheoryDifficulty>('Mid');
  const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([]);

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

  if (userQuery.isError || !userQuery.data) {
    return (
      <main className="mx-auto w-full max-w-3xl">
        <QueryErrorState
          title="Couldn’t load your profile"
          description="Your account role is needed to set the requested session size. Check the API connection and try again."
          details={userQuery.error?.message}
          onRetry={() => void userQuery.refetch()}
          isRetrying={userQuery.isFetching}
        />
      </main>
    );
  }

  const { isPremium, totalQuestions } = getPracticePolicy(userQuery.data.role);

  const handleStart = () => {
    const body: IStartTheorySessionBody = {
      ...(mode === 'topic' ? { topicId } : {}),
      ...(mode === 'pdf' ? { pdfIds: selectedPdfIds } : {}),
      mode,
      difficulty,
      totalQuestions,
    };
    void practice.start(body);
  };

  if (practice.completedSession) {
    return (
      <TheorySessionComplete
        session={practice.completedSession}
        answers={practice.savedAnswers}
        onPracticeAgain={practice.reset}
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
          <main className="mx-auto w-full max-w-3xl rounded-xl border border-rose-400/20 bg-rose-400/[0.05] p-5 sm:p-6">
            <h1 className="text-lg font-semibold text-zinc-100">
              PDF questions could not be prepared
            </h1>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              Check the error details, retry question generation, or end this session and choose
              another source.
            </p>
            {practice.questionsQuery.error?.message ? (
              <p className="mt-3 break-words rounded-lg bg-black/20 p-3 text-xs leading-5 text-rose-200">
                {practice.questionsQuery.error.message}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={practice.questionsQuery.isFetching}
                onClick={() => void practice.questionsQuery.refetch()}
                className="min-h-10 rounded-lg border border-white/10 px-4 text-sm font-medium text-zinc-100 hover:bg-white/[0.06] disabled:opacity-50"
              >
                {practice.questionsQuery.isFetching ? 'Retrying…' : 'Retry questions'}
              </button>
              <button
                type="button"
                disabled={practice.isCompleting}
                onClick={() => void practice.end()}
                className="min-h-10 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
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
        <main className="mx-auto w-full max-w-3xl rounded-xl border border-white/[0.08] bg-[#18181b] p-5 sm:p-6">
          <h1 className="mb-2 text-xl font-semibold text-zinc-100">No questions available</h1>
          <p className="text-sm leading-6 text-zinc-400">
            The server returned no questions for this session. End it and choose a different topic.
          </p>
          <button
            type="button"
            onClick={practice.end}
            className="mt-4 min-h-10 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
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
            className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-5"
          >
            <h1 className="text-lg font-semibold text-zinc-100">
              Session completion needs attention
            </h1>
            <p className="mt-1 text-sm text-zinc-300">
              {practice.completionError || 'The session could not be completed.'}
            </p>
            <button
              type="button"
              disabled={practice.isCompleting}
              onClick={practice.retryCompletion}
              className="mt-4 min-h-10 rounded-lg border border-white/10 px-4 text-sm text-zinc-100 disabled:opacity-60"
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
            canContinue={practice.canContinue}
            onRetryEvaluation={() => void practice.evaluationQuery.refetch()}
            onContinue={practice.continueAfterSubmit}
            onEnd={() => void practice.end()}
          />
        ) : null}
        {practice.completionError ? (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] p-3 text-sm text-rose-300"
          >
            <p>{practice.completionError}</p>
            <button
              type="button"
              disabled={practice.isCompleting}
              onClick={practice.retryCompletion}
              className="mt-2 min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-200 disabled:opacity-60"
            >
              {practice.isCompleting ? 'Completing…' : 'Retry session completion'}
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <PracticeSetup
      mode={mode}
      topicId={topicId}
      difficulty={difficulty}
      totalQuestions={totalQuestions}
      isPremium={isPremium}
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
  );
};
