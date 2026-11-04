export interface IDashboardPageRequest {
  page: number;
  limit: number;
}

export interface ITheorySession {
  id: string;
  topicId: string | null;
  mode: 'topic' | 'weak' | 'pdf';
  difficulty: 'Junior' | 'Mid' | 'Senior';
  totalQuestions: number;
  questionsAnswered: number;
  avgScore: number;
  status: 'in_progress' | 'completed';
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface ITheorySessionHistory {
  sessions: ITheorySession[];
  total: number;
  page: number;
  limit: number;
}

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

export interface ITheoryWeakArea {
  topicId: string;
  topicName: string;
  avgScore: number;
  sessionsCount: number;
  lastPracticed: string | null;
}

export interface ITheoryScoreTrendPoint {
  date: string;
  avgScore: number;
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
