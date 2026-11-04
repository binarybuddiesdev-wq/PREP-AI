const DASHBOARD_ROOT_KEY = ['prepai', 'dashboard'] as const;

export const dashboardKeys = {
  all: DASHBOARD_ROOT_KEY,
  theoryHistory: (userId: string) => [...DASHBOARD_ROOT_KEY, userId, 'theory-history'] as const,
  codingHistory: (userId: string) => [...DASHBOARD_ROOT_KEY, userId, 'coding-history'] as const,
  scoreTrend: (userId: string) => [...DASHBOARD_ROOT_KEY, userId, 'score-trend'] as const,
  weakAreas: (userId: string) => [...DASHBOARD_ROOT_KEY, userId, 'weak-areas'] as const,
  practiceTopics: (userId: string) => [...DASHBOARD_ROOT_KEY, userId, 'practice-topics'] as const,
};
