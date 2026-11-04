import type { ITheoryScoreTrendPoint, ITheorySession, ITheoryWeakArea } from '../theory';

export interface ICodingSession {
  id: string;
  problemIds: string[];
  problemsAttempted: number;
  problemsSolved: number;
  status: 'in_progress' | 'completed';
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface ICodingSessionHistory {
  sessions: ICodingSession[];
  total: number;
  page: number;
  limit: number;
}

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
