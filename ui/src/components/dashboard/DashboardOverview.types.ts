import type { ICodingProblemSummary, IDashboardSummary, IPracticeTopic } from '@/core';

export interface IDashboardPanelStatus {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  error: Error | null;
  onRetry: () => void;
}

export interface IDashboardOverviewProps {
  name: string;
  summary: IDashboardSummary;
  practiceTopics: IPracticeTopic[];
  codingProblems: ICodingProblemSummary[];
  theoryStatus: IDashboardPanelStatus;
  codingStatus: IDashboardPanelStatus;
  codingProblemsStatus: IDashboardPanelStatus;
  scoreTrendStatus: IDashboardPanelStatus;
  weakAreasStatus: IDashboardPanelStatus;
  practiceTopicsStatus: IDashboardPanelStatus;
  settingsStatus: IDashboardPanelStatus;
  onOpenSession: (sessionId: string) => void;
}
