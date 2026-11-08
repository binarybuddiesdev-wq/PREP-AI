import { useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import type { IAuthProfileUpdate, IAuthSession, IAuthUser } from './auth.types';

export const useAuthSession = (): IAuthSession => {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const getSessionToken = useCallback(() => getToken(), [getToken]);
  const signOutSession = useCallback(() => signOut(), [signOut]);
  const updateProfile = useCallback(
    async ({ firstName, lastName }: IAuthProfileUpdate) => {
      if (!user) throw new Error('Your signed-in account could not be loaded. Please try again.');
      await user.update({ firstName, lastName });
    },
    [user]
  );

  const authUser: IAuthUser | null = user
    ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.emailAddresses[0]?.emailAddress ?? null,
        createdAt: user.createdAt,
      }
    : null;

  return {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    user: authUser,
    updateProfile,
    getToken: getSessionToken,
    signOut: signOutSession,
  };
};
