import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { theoryKeys } from './theory.keys';
import { useTheorySessionCommand } from './useTheorySessionCommand';

const mocks = vi.hoisted(() => ({ startTheorySession: vi.fn() }));

vi.mock('@/service/api', () => ({ startTheorySession: mocks.startTheorySession }));
vi.mock('../api', () => ({ useApiClient: () => ({}) }));
vi.mock('../auth', () => ({
  useSessionReader: () => ({ isLoaded: true, isSignedIn: true, user: { id: 'clerk-one' } }),
}));

const createWrapper = (queryClient: QueryClient) => {
  const Wrapper = (props: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
  );
  return Wrapper;
};

const sessionRequest = {
  body: {
    topicId: 'topic-one',
    mode: 'topic' as const,
    difficulty: 'Mid' as const,
    totalQuestions: 10,
  },
  idempotencyKey: 'start-key',
};

describe('useTheorySessionCommand', () => {
  it('invalidates the current user usage after a successful session start', async () => {
    const queryClient = new QueryClient();
    const statsKey = theoryKeys.stats('clerk-one');
    queryClient.setQueryData(statsKey, {
      dailySessions: { used: 0, limit: 3 },
      questionsPerSession: 10,
    });
    mocks.startTheorySession.mockResolvedValue({
      data: { id: 'session-one' },
    });
    const { result } = renderHook(() => useTheorySessionCommand(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync(sessionRequest);

    await waitFor(() => {
      expect(queryClient.getQueryState(statsKey)?.isInvalidated).toBe(true);
    });
  });

  it('refreshes usage after a rejected session start', async () => {
    const queryClient = new QueryClient();
    const statsKey = theoryKeys.stats('clerk-one');
    queryClient.setQueryData(statsKey, {
      dailySessions: { used: 3, limit: 3 },
      questionsPerSession: 10,
    });
    mocks.startTheorySession.mockRejectedValue(new Error('Daily limit reached.'));
    const { result } = renderHook(() => useTheorySessionCommand(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.mutateAsync(sessionRequest)).rejects.toThrow(
      'Daily limit reached.'
    );

    await waitFor(() => {
      expect(queryClient.getQueryState(statsKey)?.isInvalidated).toBe(true);
    });
  });
});
