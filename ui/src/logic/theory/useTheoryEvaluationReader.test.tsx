import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTheoryAnswerEvaluation } from '@/service/api';
import { useTheoryEvaluationReader } from './useTheoryEvaluationReader';

const session = vi.hoisted(() => ({ isLoaded: true, isSignedIn: true, user: { id: 'user-one' } }));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', () => ({ getTheoryAnswerEvaluation: vi.fn() }));

const answer = (status: 'queued' | 'running' | 'completed' | 'failed') => ({
  id: 'answer-one',
  sessionId: 'session-one',
  questionId: null,
  questionText: 'Question',
  userAnswer: 'Answer',
  aiScore: status === 'completed' ? 8 : null,
  aiFeedback: null,
  evaluationProvider: null,
  evaluationModel: null,
  evaluationPromptVersion: null,
  status,
  failureMessage: null,
  startedAt: null,
  completedAt: null,
  timeTaken: null,
  createdAt: '2026-11-04T07:00:00.000Z',
  updatedAt: '2026-11-04T07:00:00.000Z',
});
const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('useTheoryEvaluationReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = true;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
  });

  it.each([
    ['queued', 1500],
    ['running', 1500],
    ['completed', false],
    ['failed', false],
  ] as const)('polls at the expected interval for %s evaluations', async (status, expected) => {
    vi.mocked(getTheoryAnswerEvaluation).mockResolvedValue(envelope(answer(status)));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useTheoryEvaluationReader('session-one', 'answer-one'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = queryClient.getQueryCache().getAll()[0];
    const refetchInterval = (
      query.options as unknown as {
        refetchInterval?: number | false | ((query: never) => number | false);
      }
    ).refetchInterval;
    const actual =
      typeof refetchInterval === 'function' ? refetchInterval(query as never) : refetchInterval;
    expect(actual).toBe(expected);
  });
});
