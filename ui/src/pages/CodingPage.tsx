import { useState } from 'react';
import { useNavigate } from 'react-router';

import { CodingProblemCatalog, CodingStatsBar } from '@/components/coding';
import { LoadingScreen, QueryErrorState } from '@/components/layout';
import type { CodingDifficulty } from '@/core';
import { codingProblemPath } from '@/core';
import { useCodingProblemsReader, useCodingStatsReader } from '@/logic';

export const CodingPage = () => {
  const navigate = useNavigate();
  const problemsQuery = useCodingProblemsReader();
  const statsQuery = useCodingStatsReader();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<CodingDifficulty | null>(null);
  const statsErrorDetail = statsQuery.error instanceof Error ? statsQuery.error.message.trim() : '';
  const statsErrorMessage = statsQuery.isError
    ? statsErrorDetail
      ? `Coding stats could not be loaded: ${statsErrorDetail}`
      : 'Coding stats could not be loaded.'
    : null;

  if (problemsQuery.isPending && !problemsQuery.data) {
    return <LoadingScreen label="Loading coding problems..." layout="embedded" />;
  }

  if (problemsQuery.isError && !problemsQuery.data) {
    return (
      <main className="mx-auto w-full max-w-6xl">
        <QueryErrorState
          title="Couldn’t load coding problems"
          description="The problem catalogue could not be loaded. Check your connection and try again."
          details={problemsQuery.error.message}
          onRetry={() => void problemsQuery.refetch()}
          isRetrying={problemsQuery.isFetching}
        />
      </main>
    );
  }

  const problems = problemsQuery.data ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-h)]">
          Coding Questions
        </h1>
        <p className="mt-1 text-sm text-[var(--dim)]">
          Practice algorithm and data structure problems with AI feedback.
        </p>
      </header>
      <CodingStatsBar
        stats={statsQuery.data ?? null}
        isLoading={statsQuery.isPending}
        isRetrying={statsQuery.isFetching && !statsQuery.isPending}
        errorMessage={statsErrorMessage}
        onRetry={() => void statsQuery.refetch()}
      />
      <CodingProblemCatalog
        problems={problems}
        selectedTopic={selectedTopic}
        selectedDifficulty={selectedDifficulty}
        onSelectTopic={setSelectedTopic}
        onSelectDifficulty={setSelectedDifficulty}
        onSelectProblem={(problemIdOrSlug) => navigate(codingProblemPath(problemIdOrSlug))}
      />
    </main>
  );
};
