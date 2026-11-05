import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ICodingExecution, ICodingExecutionAnswer } from '@/core';
import { getCodingExecution } from '@/service/api';
import { dashboardKeys } from '../dashboard';
import { codingKeys } from './coding.keys';
import { useCodingExecutionReader } from './useCodingExecutionReader';

const session = vi.hoisted(() => ({ isLoaded: true, isSignedIn: true, user: { id: 'user-one' } }));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', () => ({ getCodingExecution: vi.fn() }));

const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const execution = (
  status: ICodingExecution['status'],
  operation: ICodingExecution['operation'] = 'run',
  reviewStatus: ICodingExecutionAnswer['aiReviewStatus'] = 'not_requested'
) =>
  ({
    id: 'execution-one',
    sessionId: 'session-one',
    problemId: 'problem-one',
    operation,
    language: 'javascript',
    status,
    result:
      status === 'completed'
        ? {
            status: 'accepted',
            testCasesPassed: 1,
            testCasesTotal: 1,
            testCases: [{ input: [1], expected: 1, got: 1, passed: true }],
            runtime: null,
            memoryUsage: null,
          }
        : null,
    failureMessage: null,
    createdAt: '2026-11-05T10:00:00.000Z',
    startedAt: status === 'running' || status === 'completed' ? '2026-11-05T10:00:01.000Z' : null,
    completedAt: status === 'completed' || status === 'failed' ? '2026-11-05T10:00:02.000Z' : null,
    answer:
      operation === 'submit'
        ? {
            id: 'answer-one',
            executionId: 'execution-one',
            sessionId: 'session-one',
            userId: 'user-one',
            problemId: 'problem-one',
            language: 'javascript',
            code: 'return 1;',
            status: 'accepted',
            testCasesPassed: 1,
            testCasesTotal: 1,
            runtime: null,
            memoryUsage: null,
            createdAt: '2026-11-05T10:00:00.000Z',
            aiReviewStatus: reviewStatus,
            aiReviewJson: null,
            aiReviewFailureMessage: reviewStatus === 'failed' ? 'review_unavailable' : null,
          }
        : null,
  }) satisfies ICodingExecution;
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('useCodingExecutionReader', () => {
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
  ] as const)('polls every 1.5 seconds only while execution is %s', async (status, expected) => {
    vi.mocked(getCodingExecution).mockResolvedValue(envelope(execution(status)));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCodingExecutionReader('session-one', 'execution-one'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCodingExecution).toHaveBeenCalledWith({}, 'session-one', 'execution-one');
    const query = queryClient.getQueryCache().getAll()[0];
    const interval = (
      query.options as unknown as {
        refetchInterval?: number | false | ((query: never) => number | false);
      }
    ).refetchInterval;
    expect(typeof interval === 'function' ? interval(query as never) : interval).toBe(expected);
  });

  it.each([
    ['queued', 1500],
    ['running', 1500],
    ['completed', false],
    ['failed', false],
    ['not_requested', false],
  ] as const)(
    'keeps polling a completed submission while review is %s',
    async (reviewStatus, expected) => {
      vi.mocked(getCodingExecution).mockResolvedValue(
        envelope(execution('completed', 'submit', reviewStatus))
      );
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { result } = renderHook(
        () => useCodingExecutionReader('session-one', 'execution-one'),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const query = queryClient.getQueryCache().getAll()[0];
      const interval = (
        query.options as unknown as {
          refetchInterval?: number | false | ((query: never) => number | false);
        }
      ).refetchInterval;
      expect(typeof interval === 'function' ? interval(query as never) : interval).toBe(expected);
    }
  );

  it('refreshes solved-problem and dashboard history data when a submit terminates', async () => {
    vi.mocked(getCodingExecution).mockResolvedValue(envelope(execution('completed', 'submit')));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const problemListKey = codingKeys.problems('user-one');
    const historyKey = dashboardKeys.codingHistory('user-one');
    queryClient.setQueryData(problemListKey, []);
    queryClient.setQueryData(historyKey, []);
    const { result } = renderHook(() => useCodingExecutionReader('session-one', 'execution-one'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      expect(
        queryClient.getQueryCache().find({ queryKey: problemListKey })?.state.isInvalidated
      ).toBe(true);
      expect(queryClient.getQueryCache().find({ queryKey: historyKey })?.state.isInvalidated).toBe(
        true
      );
    });
  });

  it('does not invalidate solved status after a Run completes', async () => {
    vi.mocked(getCodingExecution).mockResolvedValue(envelope(execution('completed', 'run')));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const problemListKey = codingKeys.problems('user-one');
    queryClient.setQueryData(problemListKey, []);
    const { result } = renderHook(() => useCodingExecutionReader('session-one', 'execution-one'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      queryClient.getQueryCache().find({ queryKey: problemListKey })?.state.isInvalidated
    ).toBe(false);
  });
});
