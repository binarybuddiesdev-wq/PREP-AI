import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ICodingSessionDetail, ICodingSessionHistory } from '@/core';
import { getCodingSessionDetail, getCodingSessionHistory } from '@/service/api';
import { codingKeys } from './coding.keys';
import {
  useCodingSessionDetailReader,
  useCodingSessionHistoryReader,
} from './useCodingSessionReaders';

const session = vi.hoisted(() => ({
  isLoaded: false,
  isSignedIn: true,
  user: { id: 'user-one' as string | undefined },
}));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  getCodingSessionDetail: vi.fn(),
  getCodingSessionHistory: vi.fn(),
}));

const history: ICodingSessionHistory = {
  sessions: [],
  total: 0,
  page: 2,
  limit: 20,
};
const detail: ICodingSessionDetail = {
  id: 'session-one',
  userId: 'user-one',
  problemIds: ['problem-one'],
  problemsAttempted: 1,
  problemsSolved: 1,
  status: 'completed',
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: '2026-11-01T10:10:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
  answers: [],
};
const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('coding session readers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = false;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
  });

  it('waits for authentication and loads the requested coding history page', async () => {
    vi.mocked(getCodingSessionHistory).mockResolvedValue(envelope(history));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const pagination = { page: 2, limit: 20 };
    const { result, rerender } = renderHook(() => useCodingSessionHistoryReader(pagination), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCodingSessionHistory).not.toHaveBeenCalled();
    session.isLoaded = true;
    await act(async () => rerender());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCodingSessionHistory).toHaveBeenCalledWith({}, pagination);
    expect(result.current.data).toEqual(history);
    expect(
      queryClient.getQueryCache().find({ queryKey: codingKeys.sessionHistory('user-one', 2, 20) })
    ).toBeDefined();
  });

  it('does not load coding history while its tab is inactive', () => {
    session.isLoaded = true;
    const { result } = renderHook(
      () => useCodingSessionHistoryReader({ page: 1, limit: 20 }, false),
      {
        wrapper: createWrapper(new QueryClient()),
      }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCodingSessionHistory).not.toHaveBeenCalled();
  });

  it('loads owner-scoped session details only when an authenticated session id exists', async () => {
    vi.mocked(getCodingSessionDetail).mockResolvedValue(envelope(detail));
    session.isLoaded = true;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(
      ({ sessionId }) => useCodingSessionDetailReader(sessionId),
      {
        initialProps: { sessionId: '' },
        wrapper: createWrapper(queryClient),
      }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCodingSessionDetail).not.toHaveBeenCalled();
    await act(async () => rerender({ sessionId: 'session-one' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCodingSessionDetail).toHaveBeenCalledWith({}, 'session-one');
    expect(result.current.data).toEqual(detail);
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: codingKeys.sessionDetail('user-one', 'session-one') })
    ).toBeDefined();
  });

  it.each([
    ['queued', 1500],
    ['running', 1500],
    ['completed', false],
    ['not_requested', false],
  ] as const)('polls coding details only while an AI review is %s', async (status, expected) => {
    vi.mocked(getCodingSessionDetail).mockResolvedValue(
      envelope({
        ...detail,
        answers: [
          {
            id: 'answer-one',
            executionId: 'execution-one',
            sessionId: detail.id,
            userId: detail.userId,
            problemId: 'problem-one',
            language: 'javascript',
            code: 'return 42;',
            status: 'accepted',
            testCasesPassed: 1,
            testCasesTotal: 1,
            runtime: null,
            memoryUsage: null,
            createdAt: detail.createdAt,
            aiReviewStatus: status,
            aiReviewJson: null,
            aiReviewFailureMessage: null,
          },
        ],
      })
    );
    session.isLoaded = true;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useCodingSessionDetailReader('session-one'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = queryClient.getQueryCache().getAll()[0];
    const interval = (
      query.options as unknown as {
        refetchInterval?: number | false | ((query: never) => number | false);
      }
    ).refetchInterval;
    expect(typeof interval === 'function' ? interval(query as never) : interval).toBe(expected);
  });

  it('exposes history failures to the page retry action', async () => {
    const error = new Error('Coding sessions unavailable.');
    vi.mocked(getCodingSessionHistory).mockRejectedValue(error);
    session.isLoaded = true;
    const { result } = renderHook(() => useCodingSessionHistoryReader({ page: 1, limit: 20 }), {
      wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(error);
    expect(result.current.refetch).toBeTypeOf('function');
  });
});
