import { ClerkProvider } from '@clerk/clerk-react';
import { CLERK_PUBLISHABLE_KEY, ROUTES } from '@/core';
import type { IAuthProviderProps } from './auth.types';

export const AuthProvider = (props: IAuthProviderProps) => {
  const { children } = props;

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl={ROUTES.signIn}>
      {children}
    </ClerkProvider>
  );
};
