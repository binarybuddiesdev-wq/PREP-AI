import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSetupCompleteCommand } from './useSetupCompleteCommand';
import { userKeys } from './user.keys';

const serviceMocks = vi.hoisted(() => ({ setupComplete: vi.fn() }));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: vi.fn(), signOut: vi.fn() }),
  useUser: () => ({ user: { id: 'clerk-user-1', emailAddresses: [] } }),
}));

vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  setupComplete: serviceMocks.setupComplete,
}));

describe('useSetupCompleteCommand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks setup complete and refreshes the cached current user', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const currentUser = { id: 'user-1', isNewUser: true };
    queryClient.setQueryData(userKeys.me('clerk-user-1'), currentUser);
    serviceMocks.setupComplete.mockResolvedValue({
      success: true,
      message: 'Setup completed',
      data: { ...currentUser, isNewUser: false },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSetupCompleteCommand(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(serviceMocks.setupComplete).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(queryClient.getQueryState(userKeys.me('clerk-user-1'))?.isInvalidated).toBe(true);
    });
  });
});
