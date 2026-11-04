import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IStartTheorySessionBody, ISubmitTheoryAnswerBody } from '@/core';
import { completeTheorySession, startTheorySession, submitTheoryAnswer } from '@/service/api';
import { dashboardKeys } from '../dashboard';
import { theoryKeys } from './theory.keys';
import {
  useTheoryAnswerCommand,
  useTheoryCompleteSessionCommand,
  useTheorySessionCommand,
} from './index';

const session = vi.hoisted(() => ({ isLoaded: true, isSignedIn: true, user: { id: 'user-one' } }));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', () => ({
  completeTheorySession: vi.fn(),
  startTheorySession: vi.fn(),
  submitTheoryAnswer: vi.fn(),
}));

const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const sessionResult = {
  id: 'session-one',
  topicId: 'topic-one',
  mode: 'topic' as const,
  difficulty: 'Mid' as const,
  totalQuestions: 10,
  questionsAnswered: 0,
  avgScore: 0,
  status: 'in_progress' as const,
  startedAt: '2026-11-04T07:00:00.000Z',
  completedAt: null,
  createdAt: '2026-11-04T07:00:00.000Z',
};
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('theory session commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = true;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
  });

  it('starts with the exact request body and idempotency key', async () => {
    vi.mocked(startTheorySession).mockResolvedValue(envelope(sessionResult));
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useTheorySessionCommand(), {
      wrapper: createWrapper(queryClient),
    });
    const body: IStartTheorySessionBody = {
      topicId: 'topic-one',
      mode: 'topic',
      difficulty: 'Mid',
      totalQuestions: 10,
    };

    await act(async () => {
      await result.current.mutateAsync({ body, idempotencyKey: 'start-key' });
    });

    expect(startTheorySession).toHaveBeenCalledWith({}, body, 'start-key');
    await waitFor(() => expect(result.current.data).toEqual(sessionResult));
  });

  it('retains the exact answer variables after a failed request for safe retry', async () => {
    const networkError = new Error('Request timed out');
    vi.mocked(submitTheoryAnswer).mockRejectedValue(networkError);
    const { result } = renderHook(() => useTheoryAnswerCommand(), {
      wrapper: createWrapper(new QueryClient()),
    });
    const variables = {
      sessionId: 'session-one',
      body: {
        questionId: 'question-one',
        questionText: 'What is a hook?',
        userAnswer: 'A reusable stateful function.',
        timeTaken: 42,
      } satisfies ISubmitTheoryAnswerBody,
      idempotencyKey: 'answer-key',
    };

    await act(async () => {
      await result.current.mutateAsync(variables).catch(() => undefined);
    });

    expect(submitTheoryAnswer).toHaveBeenCalledWith(
      {},
      variables.sessionId,
      variables.body,
      variables.idempotencyKey
    );
    await waitFor(() => {
      expect(result.current.variables).toBe(variables);
      expect(result.current.error).toBe(networkError);
    });
  });

  it('invalidates theory and dashboard session data after completion', async () => {
    vi.mocked(completeTheorySession).mockResolvedValue(
      envelope({ ...sessionResult, status: 'completed' })
    );
    const queryClient = new QueryClient();
    const invalidationTargets = [
      theoryKeys.history('user-one'),
      theoryKeys.sessionDetail('user-one', 'session-one'),
      dashboardKeys.theoryHistory('user-one'),
      dashboardKeys.weakAreas('user-one'),
      dashboardKeys.scoreTrend('user-one'),
    ];
    for (const queryKey of invalidationTargets) queryClient.setQueryData(queryKey, []);
    const { result } = renderHook(() => useTheoryCompleteSessionCommand(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('session-one');
    });
    await waitFor(() =>
      expect(
        invalidationTargets.every(
          (queryKey) => queryClient.getQueryCache().find({ queryKey })?.state.isInvalidated
        )
      ).toBe(true)
    );
    expect(completeTheorySession).toHaveBeenCalledWith({}, 'session-one');
  });
});
