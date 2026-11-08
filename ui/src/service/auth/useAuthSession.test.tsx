import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthSession } from './useAuthSession';

const clerkMocks = vi.hoisted(() => ({ useAuth: vi.fn(), useUser: vi.fn() }));
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
      user: { id: 'user-1', firstName: 'Test', emailAddresses: [], createdAt: new Date(0) },
    });
  });

  it('keeps auth callbacks stable across renders', () => {
    const { result, rerender } = renderHook(() => useAuthSession());
    const getToken = result.current.getToken;
    const signOut = result.current.signOut;

    rerender();

    expect(result.current.getToken).toBe(getToken);
    expect(result.current.signOut).toBe(signOut);
  });
});
