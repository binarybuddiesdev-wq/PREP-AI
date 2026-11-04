import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HTTPError } from 'ky';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ITheorySessionHistory } from '@/core';
import { getTheorySessionHistory } from '@/service/api';
import { createQueryClient } from '../queryClient';
import { theoryKeys } from './theory.keys';
import { useTheorySessionHistoryReader } from './useTheorySessionHistoryReader';

const sessionState = vi.hoisted(() => ({
  isLoaded: false,
  isSignedIn: true,
  user: { id: 'user-one' as string | undefined },
}));

vi.mock('../auth', () => ({ useSessionReader: () => ({ ...sessionState }) }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  getTheorySessionHistory: vi.fn(),
}));

const history: ITheorySessionHistory = {
  sessions: [],
  total: 0,
  page: 2,
  limit: 20,
};
const envelope = (data: ITheorySessionHistory) => ({ success: true, message: 'ok', data });
const createWrapper =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

describe('useTheorySessionHistoryReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.isLoaded = false;
    sessionState.isSignedIn = true;
    sessionState.user = { id: 'user-one' };
  });

  it('waits for Clerk, then reads and caches the requested user page', async () => {
    vi.mocked(getTheorySessionHistory).mockResolvedValue(envelope(history));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(
      () => useTheorySessionHistoryReader({ page: 2, limit: 20 }),
      { wrapper: createWrapper(queryClient) }
    );

    expect(getTheorySessionHistory).not.toHaveBeenCalled();
    sessionState.isLoaded = true;
    await act(async () => rerender());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getTheorySessionHistory).toHaveBeenCalledWith({}, { page: 2, limit: 20 });
    expect(result.current.data).toEqual(history);
    expect(
      queryClient
        .getQueryCache()
        .findAll()
        .map((query) => query.queryKey)
    ).toContainEqual(theoryKeys.history('user-one', 2, 20));
  });

  it('uses a separate cache entry when the signed-in user changes', async () => {
    vi.mocked(getTheorySessionHistory).mockResolvedValue(envelope(history));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    sessionState.isLoaded = true;
    const { rerender } = renderHook(() => useTheorySessionHistoryReader({ page: 1, limit: 10 }), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(getTheorySessionHistory).toHaveBeenCalledOnce());

    sessionState.user = { id: 'user-two' };
    await act(async () => rerender());

    await waitFor(() => expect(getTheorySessionHistory).toHaveBeenCalledTimes(2));
    expect(
      queryClient
        .getQueryCache()
        .findAll()
        .map((query) => query.queryKey)
    ).toContainEqual(theoryKeys.history('user-one', 1, 10));
    expect(
      queryClient
        .getQueryCache()
        .findAll()
        .map((query) => query.queryKey)
    ).toContainEqual(theoryKeys.history('user-two', 1, 10));
  });

  it('exposes a failed history read for a visible retry state', async () => {
    const notFound = new HTTPError(
      new Response(null, { status: 404 }),
      new Request('http://api.test'),
      {} as never
    );
    vi.mocked(getTheorySessionHistory).mockRejectedValue(notFound);
    sessionState.isLoaded = true;
    const queryClient = createQueryClient();
    const { result } = renderHook(() => useTheorySessionHistoryReader({ page: 1, limit: 10 }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(notFound);
    expect(getTheorySessionHistory).toHaveBeenCalledOnce();
    expect(result.current.refetch).toBeTypeOf('function');
  });
});
