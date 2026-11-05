import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ICodingExecution, IExecuteCodingBody, IStartCodingSessionBody } from '@/core';
import {
  requestCodingReview,
  runCodingCode,
  startCodingSession,
  submitCodingSolution,
} from '@/service/api';
import { codingKeys } from './coding.keys';
import {
  useCodingExecutionCommand,
  useCodingReviewCommand,
  useCodingSessionCommand,
} from './useCodingCommands';

const session = vi.hoisted(() => ({ isLoaded: true, isSignedIn: true, user: { id: 'user-one' } }));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', () => ({
  runCodingCode: vi.fn(),
  requestCodingReview: vi.fn(),
  startCodingSession: vi.fn(),
  submitCodingSolution: vi.fn(),
}));

const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const startedSession = {
  id: 'session-one',
  problemIds: ['problem-one'],
  problemsAttempted: 0,
  problemsSolved: 0,
  status: 'in_progress' as const,
  startedAt: '2026-11-05T10:00:00.000Z',
  completedAt: null,
  createdAt: '2026-11-05T10:00:00.000Z',
};
const acceptedExecution = {
  id: 'execution-one',
  sessionId: 'session-one',
  operation: 'run' as const,
  status: 'queued' as const,
  createdAt: '2026-11-05T10:00:00.000Z',
};
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('coding commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = true;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
  });

  it('starts a session with the exact body and caller-owned idempotency key', async () => {
    vi.mocked(startCodingSession).mockResolvedValue(envelope(startedSession));
    const { result } = renderHook(() => useCodingSessionCommand(), {
      wrapper: createWrapper(new QueryClient()),
    });
    const variables = {
      body: { problemIds: ['problem-one'] } satisfies IStartCodingSessionBody,
      idempotencyKey: 'start-key',
    };

    await act(async () => result.current.mutateAsync(variables));

    expect(startCodingSession).toHaveBeenCalledWith({}, variables.body, 'start-key');
    await waitFor(() => expect(result.current.data).toEqual(startedSession));
  });

  it.each(['run', 'submit'] as const)(
    'routes the %s command with the captured body and idempotency key',
    async (operation) => {
      const request = operation === 'run' ? runCodingCode : submitCodingSolution;
      vi.mocked(request).mockResolvedValue(envelope({ ...acceptedExecution, operation }));
      const { result } = renderHook(() => useCodingExecutionCommand(), {
        wrapper: createWrapper(new QueryClient()),
      });
      const variables = {
        operation,
        sessionId: 'session-one',
        body: {
          problemId: 'problem-one',
          language: 'typescript',
          code: 'const answer = 42;',
        } satisfies IExecuteCodingBody,
        idempotencyKey: `${operation}-key`,
      };

      await act(async () => result.current.mutateAsync(variables));

      expect(request).toHaveBeenCalledWith(
        {},
        variables.sessionId,
        variables.body,
        variables.idempotencyKey
      );
      await waitFor(() => expect(result.current.data?.operation).toBe(operation));
    }
  );

  it('retains the failed execution variables so the page can retry the same request', async () => {
    const networkError = new Error('Request timed out');
    vi.mocked(runCodingCode).mockRejectedValue(networkError);
    const { result } = renderHook(() => useCodingExecutionCommand(), {
      wrapper: createWrapper(new QueryClient()),
    });
    const variables = {
      operation: 'run' as const,
      sessionId: 'session-one',
      body: { problemId: 'problem-one', language: 'javascript' as const, code: 'return 1;' },
      idempotencyKey: 'retry-the-same-key',
    };

    await act(async () => result.current.mutateAsync(variables).catch(() => undefined));

    await waitFor(() => expect(result.current.error).toBe(networkError));
    expect(result.current.variables).toBe(variables);
  });

  it('requests a review and refreshes that execution after the server accepts it', async () => {
    const review = {
      id: 'answer-one',
      status: 'queued' as const,
      aiReviewJson: null,
      aiReviewFailureMessage: null,
    };
    vi.mocked(requestCodingReview).mockResolvedValue(envelope(review));
    const queryClient = new QueryClient();
    const queryKey = codingKeys.execution('user-one', 'session-one', 'execution-one');
    const currentExecution: ICodingExecution = {
      id: 'execution-one',
      sessionId: 'session-one',
      problemId: 'problem-one',
      operation: 'submit',
      language: 'javascript',
      status: 'completed',
      result: null,
      failureMessage: null,
      createdAt: '2026-11-05T10:00:00.000Z',
      startedAt: '2026-11-05T10:00:01.000Z',
      completedAt: '2026-11-05T10:00:02.000Z',
      answer: {
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
        createdAt: '2026-11-05T10:00:02.000Z',
        aiReviewStatus: 'not_requested',
        aiReviewJson: null,
        aiReviewFailureMessage: null,
      },
    };
    queryClient.setQueryData(queryKey, currentExecution);
    const { result } = renderHook(() => useCodingReviewCommand(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () =>
      result.current.mutateAsync({ sessionId: 'session-one', executionId: 'execution-one' })
    );

    expect(requestCodingReview).toHaveBeenCalledWith({}, 'session-one', 'execution-one');
    await waitFor(() => {
      expect(queryClient.getQueryCache().find({ queryKey })?.state.isInvalidated).toBe(true);
    });
    expect(queryClient.getQueryData<ICodingExecution>(queryKey)?.answer?.aiReviewStatus).toBe(
      'queued'
    );
  });
});
