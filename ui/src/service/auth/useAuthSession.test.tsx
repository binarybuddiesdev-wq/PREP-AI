import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthSession } from './useAuthSession';

const clerkMocks = vi.hoisted(() => ({ useAuth: vi.fn(), useUser: vi.fn(), update: vi.fn() }));
vi.mock('@clerk/clerk-react', () => clerkMocks);

describe('useAuthSession', () => {
  beforeEach(() => {
    clerkMocks.useAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue('test-token'),
      signOut: vi.fn().mockResolvedValue(undefined),
    });
    clerkMocks.useUser.mockReturnValue({
      user: {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        emailAddresses: [],
        createdAt: new Date(0),
        update: clerkMocks.update,
      },
    });
  });

  it('keeps auth callbacks stable across renders', () => {
    const { result, rerender } = renderHook(() => useAuthSession());
    const getToken = result.current.getToken;
    const signOut = result.current.signOut;
    const updateProfile = result.current.updateProfile;

    rerender();

    expect(result.current.getToken).toBe(getToken);
    expect(result.current.signOut).toBe(signOut);
    expect(result.current.updateProfile).toBe(updateProfile);
  });

  it('updates the Clerk identity fields through the auth service', async () => {
    const { result } = renderHook(() => useAuthSession());

    await result.current.updateProfile({ firstName: 'Mira', lastName: 'Shah' });

    expect(clerkMocks.update).toHaveBeenCalledWith({ firstName: 'Mira', lastName: 'Shah' });
    expect(result.current.user).toMatchObject({ firstName: 'Test', lastName: 'User' });
  });
});
