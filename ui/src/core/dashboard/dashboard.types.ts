import type { ITheoryScoreTrendPoint, ITheorySession, ITheoryWeakArea } from '../theory';
export interface IPracticeTopic {
  id: string;
  name: string;
  slug: string;
  category: 'practice' | 'coding';
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IDashboardMetrics {
  completedSessions: number;
  questionsAnswered: number;
  averageScore: number | null;
  problemsSolved: number;
  currentStreak: number;
}

export interface IDashboardWeekDay {
  label: string;
  date: string;
  isActive: boolean;
}

export interface IDashboardRecentSession {
  id: string;
  topicName: string;
  startedAt: string;
  status: ITheorySession['status'];
  questionsAnswered: number;
  totalQuestions: number;
  averageScore: number | null;
}

export interface IDashboardSetupItem {
  label: string;
  isComplete: boolean;
}

export interface IDashboardSummary {
  metrics: IDashboardMetrics;
  week: IDashboardWeekDay[];
  recentSessions: IDashboardRecentSession[];
  scoreTrend: ITheoryScoreTrendPoint[];
  suggestions: ITheoryWeakArea[];
  setupChecklist: IDashboardSetupItem[];
}
