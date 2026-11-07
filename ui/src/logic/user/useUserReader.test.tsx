import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useUserReader } from './useUserReader';
import { userKeys } from './user.keys';

const session = vi.hoisted(() => ({ userId: 'clerk-user-b' }));
const serviceMocks = vi.hoisted(() => ({ getMe: vi.fn() }));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: vi.fn(), signOut: vi.fn() }),
  useUser: () => ({
    user: {
      id: session.userId,
      firstName: 'Asha',
      emailAddresses: [{ emailAddress: 'asha@example.com' }],
    },
  }),
}));

vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  getMe: serviceMocks.getMe,
}));

describe('useUserReader', () => {
  it('does not expose another signed-in user’s cached profile', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(userKeys.me('clerk-user-a'), {
      id: 'profile-a',
      clerkUserId: 'clerk-user-a',
      email: 'a@example.com',
      name: 'Account A',
      role: 'USER',
      isNewUser: false,
    });
    serviceMocks.getMe.mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        id: 'profile-b',
        clerkUserId: 'clerk-user-b',
        email: 'asha@example.com',
        name: 'Asha',
        role: 'USER',
        isNewUser: false,
      },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUserReader(), { wrapper });

    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.clerkUserId).toBe('clerk-user-b'));
    expect(queryClient.getQueryData(userKeys.me('clerk-user-a'))).toMatchObject({
      clerkUserId: 'clerk-user-a',
      name: 'Account A',
    });
  });
});
