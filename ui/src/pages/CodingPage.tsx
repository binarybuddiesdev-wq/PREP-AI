import { useState } from 'react';
import { useNavigate } from 'react-router';

import { CodingProblemCatalog } from '@/components/coding';
import { LoadingScreen, QueryErrorState } from '@/components/layout';
import type { CodingDifficulty } from '@/core';
import { codingProblemPath } from '@/core';
import { useCodingProblemsReader } from '@/logic';

export const CodingPage = () => {
  const navigate = useNavigate();
  const problemsQuery = useCodingProblemsReader();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<CodingDifficulty | null>(null);

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
        <p className="mt-1 text-sm text-zinc-400">
          Practice algorithm and data structure problems with AI feedback.
        </p>
      </header>
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
