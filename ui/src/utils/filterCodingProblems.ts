import type { CodingDifficulty, ICodingProblemSummary } from '@/core';

export const getCodingProblemTopics = (problems: readonly ICodingProblemSummary[]): string[] => [
  ...new Set(problems.map((problem) => problem.topic)),
];

export const filterCodingProblems = (
  problems: readonly ICodingProblemSummary[],
  selectedTopic: string | null,
  selectedDifficulty: CodingDifficulty | null
): ICodingProblemSummary[] =>
  problems.filter(
    (problem) =>
      (!selectedTopic || problem.topic === selectedTopic) &&
      (!selectedDifficulty || problem.difficulty === selectedDifficulty)
  );
