import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ITheorySession } from '@/core';
import {
  getCodingSessionHistory,
  getPracticeTopics,
  getTheoryScoreTrend,
  getTheorySessionHistory,
  getTheoryWeakAreas,
} from '@/service/api';
import { useDashboardDataReader } from './useDashboardDataReader';

const session = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true,
  user: { id: 'user-one' },
}));

vi.mock('../auth', () => ({
  useSessionReader: () => ({ ...session }),
}));

vi.mock('../api', () => ({ useApiClient: () => ({}) }));

vi.mock('@/service/api', () => ({
  getTheorySessionHistory: vi.fn(),
  getCodingSessionHistory: vi.fn(),
  getTheoryScoreTrend: vi.fn(),
  getTheoryWeakAreas: vi.fn(),
  getPracticeTopics: vi.fn(),
}));

const envelope = <T,>(data: T) => ({ success: true, message: 'ok', data });
const theorySession = (id: string): ITheorySession => ({
  id,
  topicId: null,
  mode: 'topic',
  difficulty: 'Mid',
  totalQuestions: 1,
  questionsAnswered: 1,
  avgScore: 6,
  status: 'completed',
  startedAt: '2026-11-04T07:00:00.000Z',
  completedAt: '2026-11-04T07:01:00.000Z',
  createdAt: '2026-11-04T07:00:00.000Z',
});

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useDashboardDataReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = true;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
  });

  it('loads empty account history and returns neutral dashboard metrics', async () => {
    vi.mocked(getTheorySessionHistory).mockResolvedValue(
      envelope({ sessions: [], total: 0, page: 1, limit: 100 })
    );
    vi.mocked(getCodingSessionHistory).mockResolvedValue(
      envelope({ sessions: [], total: 0, page: 1, limit: 100 })
    );
    vi.mocked(getTheoryScoreTrend).mockResolvedValue(envelope([]));
    vi.mocked(getTheoryWeakAreas).mockResolvedValue(envelope([]));
    vi.mocked(getPracticeTopics).mockResolvedValue(envelope([]));

    const { result } = renderHook(() => useDashboardDataReader(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.theorySessionsQuery.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.codingSessionsQuery.isSuccess).toBe(true));
    expect(result.current.summary.metrics).toMatchObject({
      completedSessions: 0,
      questionsAnswered: 0,
      averageScore: null,
      problemsSolved: 0,
      currentStreak: 0,
    });
    expect(getTheorySessionHistory).toHaveBeenCalledWith({}, { page: 1, limit: 100 });
    expect(getCodingSessionHistory).toHaveBeenCalledWith({}, { page: 1, limit: 100 });
  });

  it('keeps dashboard requests disabled until Clerk is ready and signed in', async () => {
    session.isLoaded = false;
    session.isSignedIn = false;

    const { result } = renderHook(() => useDashboardDataReader(), { wrapper: createWrapper() });

    expect(result.current.theorySessionsQuery.fetchStatus).toBe('idle');
    expect(getTheorySessionHistory).not.toHaveBeenCalled();
  });

  it('continues loading theory history until the server-reported total is covered', async () => {
    vi.mocked(getTheorySessionHistory)
      .mockResolvedValueOnce(
        envelope({
          sessions: Array.from({ length: 100 }, (_, index) => theorySession(`session-${index}`)),
          total: 101,
          page: 1,
          limit: 100,
        })
      )
      .mockResolvedValueOnce(
        envelope({ sessions: [theorySession('session-100')], total: 101, page: 2, limit: 100 })
      );
    vi.mocked(getCodingSessionHistory).mockResolvedValue(
      envelope({ sessions: [], total: 0, page: 1, limit: 100 })
    );
    vi.mocked(getTheoryScoreTrend).mockResolvedValue(envelope([]));
    vi.mocked(getTheoryWeakAreas).mockResolvedValue(envelope([]));
    vi.mocked(getPracticeTopics).mockResolvedValue(envelope([]));

    const { result } = renderHook(() => useDashboardDataReader(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.theorySessionsQuery.isSuccess).toBe(true));
    expect(result.current.theorySessionsQuery.data).toHaveLength(101);
    expect(getTheorySessionHistory).toHaveBeenNthCalledWith(2, {}, { page: 2, limit: 100 });
  });

  it('reports a partial history response instead of treating it as complete', async () => {
    vi.mocked(getTheorySessionHistory).mockResolvedValue(
      envelope({ sessions: [], total: 1, page: 1, limit: 100 })
    );
    vi.mocked(getCodingSessionHistory).mockResolvedValue(
      envelope({ sessions: [], total: 0, page: 1, limit: 100 })
    );
    vi.mocked(getTheoryScoreTrend).mockResolvedValue(envelope([]));
    vi.mocked(getTheoryWeakAreas).mockResolvedValue(envelope([]));
    vi.mocked(getPracticeTopics).mockResolvedValue(envelope([]));

    const { result } = renderHook(() => useDashboardDataReader(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.theorySessionsQuery.isError).toBe(true));
    expect(result.current.theorySessionsQuery.error?.message).toMatch(/history is incomplete/i);
  });

  it('exposes a dashboard source failure for the page retry state', async () => {
    vi.mocked(getTheorySessionHistory).mockRejectedValue(
      new Error('Theory history is unavailable')
    );
    vi.mocked(getCodingSessionHistory).mockResolvedValue(
      envelope({ sessions: [], total: 0, page: 1, limit: 100 })
    );
    vi.mocked(getTheoryScoreTrend).mockResolvedValue(envelope([]));
    vi.mocked(getTheoryWeakAreas).mockResolvedValue(envelope([]));
    vi.mocked(getPracticeTopics).mockResolvedValue(envelope([]));

    const { result } = renderHook(() => useDashboardDataReader(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.theorySessionsQuery.isError).toBe(true));
    expect(result.current.theorySessionsQuery.error?.message).toBe('Theory history is unavailable');
    expect(result.current.codingSessionsQuery.isSuccess).toBe(true);
  });
});
