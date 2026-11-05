import { useNavigate, useParams } from 'react-router';

import { CodingProblemDetail } from '@/components/coding';
import { LoadingScreen, QueryErrorState } from '@/components/layout';
import { ROUTES } from '@/core';
import { getHttpStatus, useCodingProblemReader } from '@/logic';

export const CodingProblemPage = () => {
  const { problemId } = useParams();
  const navigate = useNavigate();
  const detailQuery = useCodingProblemReader(problemId ?? '');
  const returnToList = () => navigate(ROUTES.coding);

  if (!problemId) {
    return (
      <main className="mx-auto w-full max-w-3xl rounded-xl border border-white/[0.08] bg-[#18181b] p-5">
        <h1 className="text-lg font-semibold text-zinc-100">Problem ID is missing</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Choose a coding problem from the catalogue to view its details.
        </p>
        <button
          type="button"
          onClick={returnToList}
          className="mt-4 min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-100 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        >
          Back to problems
        </button>
      </main>
    );
  }

  if (detailQuery.isPending && !detailQuery.data) {
    return <LoadingScreen label="Loading problem details..." layout="embedded" />;
  }

  if (detailQuery.isError && !detailQuery.data) {
    if (getHttpStatus(detailQuery.error) === 404) {
      return (
        <main className="mx-auto w-full max-w-3xl rounded-xl border border-white/[0.08] bg-[#18181b] p-5">
          <h1 className="text-lg font-semibold text-zinc-100">Problem not found</h1>
          <p className="mt-1 text-sm text-zinc-400">
            This problem may have been removed or the link may be out of date.
          </p>
          <button
            type="button"
            onClick={returnToList}
            className="mt-4 min-h-9 rounded-lg border border-white/10 px-3 text-sm text-zinc-100 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            Back to problems
          </button>
        </main>
      );
    }

    return (
      <main className="mx-auto w-full max-w-4xl">
        <QueryErrorState
          title="Couldn’t load this problem"
          description="The problem details could not be loaded. Check your connection and try again."
          details={detailQuery.error.message}
          onRetry={() => void detailQuery.refetch()}
          isRetrying={detailQuery.isFetching}
        />
      </main>
    );
  }

  if (!detailQuery.data) return null;

  return (
    <main className="w-full">
      <CodingProblemDetail problem={detailQuery.data} onBack={returnToList} />
    </main>
  );
};
