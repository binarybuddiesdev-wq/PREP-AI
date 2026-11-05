import type { ICodingProblemSummary, IPracticeTopic } from '@/core';
import type { IDashboardPanelStatus } from './DashboardOverview.types';

export interface IDashboardPracticeCodingProps {
  practiceTopics: IPracticeTopic[];
  practiceTopicsStatus: IDashboardPanelStatus;
  codingProblems: ICodingProblemSummary[];
  codingProblemsStatus: IDashboardPanelStatus;
}
