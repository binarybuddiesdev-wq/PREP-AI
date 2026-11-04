const THEORY_ROOT_KEY = ['prepai', 'theory'] as const;

export const theoryKeys = {
  all: THEORY_ROOT_KEY,
  user: (userId: string) => [...THEORY_ROOT_KEY, userId] as const,
  practiceTopics: (userId: string) => [...THEORY_ROOT_KEY, userId, 'practice-topics'] as const,
  weakAreas: (userId: string) => [...THEORY_ROOT_KEY, userId, 'weak-areas'] as const,
  scoreTrend: (userId: string, limit?: number) =>
    [...THEORY_ROOT_KEY, userId, 'score-trend', ...(limit === undefined ? [] : [limit])] as const,
  history: (userId: string, page?: number, limit?: number) =>
    [
      ...THEORY_ROOT_KEY,
      userId,
      'history',
      ...(page === undefined || limit === undefined ? [] : [{ page, limit }]),
    ] as const,
  sessionQuestions: (userId: string, sessionId: string, limit?: number) =>
    [
      ...THEORY_ROOT_KEY,
      userId,
      'session',
      sessionId,
      'questions',
      ...(limit === undefined ? [] : [limit]),
    ] as const,
  sessionDetail: (userId: string, sessionId: string) =>
    [...THEORY_ROOT_KEY, userId, 'session', sessionId, 'detail'] as const,
  evaluation: (userId: string, sessionId: string, answerId: string) =>
    [...THEORY_ROOT_KEY, userId, 'session', sessionId, 'answer', answerId] as const,
};
