import type { IDashboardSummary } from '@/core';

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
  theoryStatus: IDashboardPanelStatus;
  codingStatus: IDashboardPanelStatus;
  scoreTrendStatus: IDashboardPanelStatus;
  weakAreasStatus: IDashboardPanelStatus;
  practiceTopicsStatus: IDashboardPanelStatus;
  settingsStatus: IDashboardPanelStatus;
  onOpenSession: (sessionId: string) => void;
}
