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
      <main className="mx-auto w-full max-w-3xl rounded-xl border border-white/[0.08] bg-[#18181b] p-5">
        <h1 className="text-lg font-semibold text-zinc-100">Session ID is missing</h1>
        <p className="mt-1 text-sm text-zinc-400">Choose a session from your history to view it.</p>
        <button
          type="button"
          onClick={() => navigate(ROUTES.history)}
          className="mt-4 min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-100 hover:bg-white/[0.06]"
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
        <main className="mx-auto w-full max-w-3xl rounded-xl border border-white/[0.08] bg-[#18181b] p-5">
          <h1 className="text-lg font-semibold text-zinc-100">Session not found</h1>
          <p className="mt-1 text-sm text-zinc-400">
            This session may have been removed or may not belong to your account.
          </p>
          <button
            type="button"
            onClick={() => navigate(ROUTES.history)}
            className="mt-4 min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-100 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
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
