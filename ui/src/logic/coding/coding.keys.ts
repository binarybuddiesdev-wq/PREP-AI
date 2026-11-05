const CODING_ROOT_KEY = ['prepai', 'coding'] as const;

export const codingKeys = {
  all: CODING_ROOT_KEY,
  user: (userId: string) => [...CODING_ROOT_KEY, userId] as const,
  problems: (userId: string) => [...CODING_ROOT_KEY, userId, 'problems'] as const,
  problem: (userId: string, problemIdOrSlug: string) =>
    [...CODING_ROOT_KEY, userId, 'problem', problemIdOrSlug] as const,
  sessionHistories: (userId: string) => [...CODING_ROOT_KEY, userId, 'sessions'] as const,
  sessionHistory: (userId: string, page: number, limit: number) =>
    [...CODING_ROOT_KEY, userId, 'sessions', { page, limit }] as const,
  sessionDetail: (userId: string, sessionId: string) =>
    [...CODING_ROOT_KEY, userId, 'session', sessionId, 'detail'] as const,
  execution: (userId: string, sessionId: string, executionId: string) =>
    [...CODING_ROOT_KEY, userId, 'session', sessionId, 'execution', executionId] as const,
};
