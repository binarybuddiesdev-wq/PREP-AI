import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ICodingStats } from '@/core';
import { getCodingStats } from '@/service/api';
import { codingKeys } from './coding.keys';
import { useCodingStatsReader } from './useCodingStatsReader';

const session = vi.hoisted(() => ({
  isLoaded: false,
  isSignedIn: true,
  user: { id: 'user-one' as string | undefined },
}));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...session }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  getCodingStats: vi.fn(),
}));

const stats: ICodingStats = {
  solved: 7,
  dailySolved: { used: 2, limit: 5 },
  dailyReviews: { used: 1, limit: 3 },
  streakDays: 4,
};
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('useCodingStatsReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = false;
    session.isSignedIn = true;
    session.user = { id: 'user-one' };
  });

  it('waits until Clerk is loaded before reading stats', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(() => useCodingStatsReader(), {
      wrapper: createWrapper(queryClient),
    });
    vi.mocked(getCodingStats).mockResolvedValue({ success: true, message: 'ok', data: stats });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCodingStats).not.toHaveBeenCalled();

    session.isLoaded = true;
    await act(async () => rerender());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stats);
    expect(getCodingStats).toHaveBeenCalledWith({});
    expect(
      queryClient.getQueryCache().find({ queryKey: codingKeys.stats('user-one') })
    ).toBeDefined();
  });

  it('does not request stats for a signed-out user', () => {
    session.isLoaded = true;
    session.isSignedIn = false;
    const { result } = renderHook(() => useCodingStatsReader(), {
      wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCodingStats).not.toHaveBeenCalled();
  });

  it('returns the API error state without replacing it with default usage values', async () => {
    session.isLoaded = true;
    vi.mocked(getCodingStats).mockRejectedValueOnce(new Error('Coding stats unavailable'));
    const { result } = renderHook(() => useCodingStatsReader(), {
      wrapper: createWrapper(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Coding stats unavailable');
  });
});
