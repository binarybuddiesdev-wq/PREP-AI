import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';

import { TheorySessionDetail } from '@/components/history';
import { LoadingScreen, QueryErrorState } from '@/components/layout';
import { ROUTES } from '@/core';
import {
  getHttpStatus,
  useTheoryCompleteSessionCommand,
  useTheorySessionDetailReader,
} from '@/logic';

export const TheorySessionDetailPage = () => {
  const { sessionId: routeSessionId } = useParams();
  const sessionId = routeSessionId?.trim() ?? '';
  const navigate = useNavigate();
  const detailQuery = useTheorySessionDetailReader(sessionId);
  const completionCommand = useTheoryCompleteSessionCommand();
  const resetCompletion = completionCommand.reset;

  useEffect(() => {
    resetCompletion();
  }, [resetCompletion, sessionId]);

  if (!sessionId) {
    return (
      <main className="mx-auto w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h1 className="text-lg font-semibold text-[var(--text-h)]">Session ID is missing</h1>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Choose a session from your history to view it.
        </p>
        <button
          type="button"
          onClick={() => navigate(ROUTES.history)}
          className="mt-4 min-h-9 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          Back to history
        </button>
      </main>
    );
  }

  if (detailQuery.isPending && !detailQuery.data) {
    return <LoadingScreen label="Loading session details…" layout="embedded" />;
  }

  if (detailQuery.isError) {
    if (getHttpStatus(detailQuery.error) === 404) {
      return (
        <main className="mx-auto w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h1 className="text-lg font-semibold text-[var(--text-h)]">Session not found</h1>
          <p className="mt-1 text-sm text-[var(--dim)]">
            This session may have been removed or may not belong to your account.
          </p>
          <button
            type="button"
            onClick={() => navigate(ROUTES.history)}
            className="mt-4 min-h-9 rounded-lg border border-[var(--border2)] px-3 text-sm text-[var(--text)] transition hover:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Back to history
          </button>
        </main>
      );
    }

    return (
      <main className="mx-auto w-full max-w-3xl">
        <QueryErrorState
          title="Couldn’t load this session"
          description="The saved session details could not be loaded. Check the API connection and try again."
          details={detailQuery.error.message}
          onRetry={() => void detailQuery.refetch()}
          isRetrying={detailQuery.isFetching}
        />
      </main>
    );
  }

  if (!detailQuery.data) return null;

  const isCompletionConfirmed =
    completionCommand.isSuccess &&
    completionCommand.data?.id === sessionId &&
    completionCommand.data.status === 'completed';
  const session =
    isCompletionConfirmed && completionCommand.data
      ? { ...detailQuery.data, ...completionCommand.data }
      : detailQuery.data;

  return (
    <TheorySessionDetail
      session={session}
      isCompleting={completionCommand.isPending}
      completionError={completionCommand.isError ? completionCommand.error.message : null}
      onComplete={() => completionCommand.mutate(sessionId)}
      onReturnToHistory={() => navigate(ROUTES.history)}
    />
  );
};
