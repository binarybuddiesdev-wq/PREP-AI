import type { CodingDifficulty, ICodingProblemSummary } from '@/core';

export interface ICodingProblemCatalogProps {
  problems: readonly ICodingProblemSummary[];
  selectedTopic: string | null;
  selectedDifficulty: CodingDifficulty | null;
  onSelectTopic: (topic: string | null) => void;
  onSelectDifficulty: (difficulty: CodingDifficulty | null) => void;
  onSelectProblem: (problemIdOrSlug: string) => void;
}
