import { useAuth, useUser } from '@clerk/clerk-react';
import type { IAuthSession, IAuthUser } from './auth.types';

export const useAuthSession = (): IAuthSession => {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();

  const authUser: IAuthUser | null = user
    ? {
        id: user.id,
        firstName: user.firstName,
        email: user.emailAddresses[0]?.emailAddress ?? null,
        createdAt: user.createdAt,
      }
    : null;

  return {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    user: authUser,
    getToken: () => getToken(),
    signOut: () => signOut(),
  };
};
