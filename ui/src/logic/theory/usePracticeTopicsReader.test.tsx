import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPracticeTopics } from '@/service/api';
import { usePracticeTopicsReader } from './usePracticeTopicsReader';

const session = vi.hoisted(() => ({ isLoaded: false, isSignedIn: true, userId: 'user-one' }));

vi.mock('../auth', () => ({
  useSessionReader: () => ({
    isLoaded: session.isLoaded,
    isSignedIn: session.isSignedIn,
    user: { id: session.userId },
  }),
}));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('@/service/api', () => ({ getPracticeTopics: vi.fn() }));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('usePracticeTopicsReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.isLoaded = false;
    session.isSignedIn = true;
    session.userId = 'user-one';
  });

  it('waits for an open search and a loaded signed-in Clerk session', async () => {
    vi.mocked(getPracticeTopics).mockResolvedValue({ success: true, message: 'ok', data: [] });
    const { result, rerender } = renderHook(({ enabled }) => usePracticeTopicsReader(enabled), {
      initialProps: { enabled: false },
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getPracticeTopics).not.toHaveBeenCalled();

    session.isLoaded = true;
    await act(async () => rerender({ enabled: false }));
    expect(getPracticeTopics).not.toHaveBeenCalled();

    await act(async () => rerender({ enabled: true }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPracticeTopics).toHaveBeenCalledOnce();
  });

  it('never requests practice topics for a signed-out user', () => {
    session.isLoaded = true;
    session.isSignedIn = false;
    const { result } = renderHook(() => usePracticeTopicsReader(true), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getPracticeTopics).not.toHaveBeenCalled();
  });
});
