import type { IPdfSource, IPracticeTopic, ITheoryWeakArea, TheoryDifficulty } from '@/core';

export type PracticeMode = 'topic' | 'weak' | 'pdf';

export interface IPracticeSetupProps {
  mode: PracticeMode;
  topicId: string;
  difficulty: TheoryDifficulty;
  totalQuestions: number;
  isPremium: boolean;
  topics: IPracticeTopic[];
  weakAreas: ITheoryWeakArea[];
  pdfSources: IPdfSource[];
  selectedPdfIds: string[];
  isPdfSourcesLoading: boolean;
  pdfSourcesError: string | null;
  onRetryPdfSources: () => void;
  onPdfSelectionChange: (pdfIds: string[]) => void;
  onManageDocuments: () => void;
  isTopicsLoading: boolean;
  topicsError: string | null;
  onRetryTopics: () => void;
  isWeakAreasLoading: boolean;
  weakAreasError: string | null;
  onRetryWeakAreas: () => void;
  isStarting: boolean;
  startError: string | null;
  onModeChange: (mode: PracticeMode) => void;
  onTopicChange: (topicId: string) => void;
  onDifficultyChange: (difficulty: TheoryDifficulty) => void;
  onStart: () => void;
}
