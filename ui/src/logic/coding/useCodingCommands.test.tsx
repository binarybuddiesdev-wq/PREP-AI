import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IExecuteCodingBody, IStartCodingSessionBody } from '@/core';
import { runCodingCode, startCodingSession, submitCodingSolution } from '@/service/api';
import { useCodingExecutionCommand, useCodingSessionCommand } from './useCodingCommands';

const session = vi.hoisted(() => ({ isLoaded: true, isSignedIn: true, user: { id: 'user-one' } }));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', () => ({
  runCodingCode: vi.fn(),
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

  it.each([
    ['run', 'runCodingCode'],
    ['submit', 'submitCodingSolution'],
  ] as const)(
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
});
