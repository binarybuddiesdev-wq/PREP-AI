import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ITheoryAnswer, ITheorySessionDetail } from '@/core';
import { getTheorySessionDetail } from '@/service/api';
import { theoryKeys } from './theory.keys';
import { useTheorySessionDetailReader } from './useTheorySessionDetailReader';

const sessionState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true,
  user: { id: 'user-one' as string | undefined },
}));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...sessionState }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', () => ({ getTheorySessionDetail: vi.fn() }));

const answer = (status: ITheoryAnswer['status']): ITheoryAnswer => ({
  id: 'answer-one',
  sessionId: 'session-one',
  questionId: null,
  questionText: 'Question?',
  userAnswer: 'Answer.',
  aiScore: status === 'completed' ? 8 : null,
  aiFeedback: null,
  evaluationProvider: null,
  evaluationModel: null,
  evaluationPromptVersion: null,
  status,
  failureMessage: null,
  startedAt: null,
  completedAt: null,
  timeTaken: 15,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
});

const detail = (status: ITheoryAnswer['status']): ITheorySessionDetail => ({
  id: 'session-one',
  topicId: 'topic-one',
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 10,
  questionsAnswered: 1,
  avgScore: status === 'completed' ? 8 : 0,
  status: 'in_progress',
  startedAt: '2026-11-01T00:00:00.000Z',
  completedAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  answers: [answer(status)],
});
const envelope = (data: ITheorySessionDetail) => ({ success: true, message: 'ok', data });
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('useTheorySessionDetailReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.isLoaded = true;
    sessionState.isSignedIn = true;
    sessionState.user = { id: 'user-one' };
  });

  it.each([[''], ['  ']])('does not request a missing session ID (%j)', async (sessionId) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useTheorySessionDetailReader(sessionId), {
      wrapper: createWrapper(queryClient),
    });

    expect(getTheorySessionDetail).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
  });

  it('gates the detail request until Clerk is ready and keys by user and session', async () => {
    vi.mocked(getTheorySessionDetail).mockResolvedValue(envelope(detail('completed')));
    sessionState.isLoaded = false;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(() => useTheorySessionDetailReader('session-one'), {
      wrapper: createWrapper(queryClient),
    });

    expect(getTheorySessionDetail).not.toHaveBeenCalled();
    sessionState.isLoaded = true;
    await act(async () => rerender());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getTheorySessionDetail).toHaveBeenCalledWith({}, 'session-one');
    expect(
      queryClient
        .getQueryCache()
        .findAll()
        .map((query) => query.queryKey)
    ).toContainEqual(theoryKeys.sessionDetail('user-one', 'session-one'));
  });

  it.each([
    ['queued', 1500],
    ['running', 1500],
    ['completed', false],
    ['failed', false],
  ] as const)('polls saved %s evaluations at the expected interval', async (status, expected) => {
    vi.mocked(getTheorySessionDetail).mockResolvedValue(envelope(detail(status)));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useTheorySessionDetailReader('session-one'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = queryClient
      .getQueryCache()
      .find({ queryKey: theoryKeys.sessionDetail('user-one', 'session-one') })!;
    const refetchInterval = (
      query.options as unknown as {
        refetchInterval?: number | false | ((query: never) => number | false);
      }
    ).refetchInterval;
    const actual =
      typeof refetchInterval === 'function' ? refetchInterval(query as never) : refetchInterval;

    expect(actual).toBe(expected);
  });

  it('exposes detail read failures for a retry action', async () => {
    vi.mocked(getTheorySessionDetail).mockRejectedValue(new Error('Session unavailable'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useTheorySessionDetailReader('session-one'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('Session unavailable');
    expect(result.current.refetch).toBeTypeOf('function');
  });
});
