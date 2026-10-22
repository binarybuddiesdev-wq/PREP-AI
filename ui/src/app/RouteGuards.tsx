import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { ROUTES } from '@/core';
import { SignedIn, SignedOut } from '@/service/auth';

interface IRouteGuardProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: IRouteGuardProps) => (
  <>
    <SignedIn>{children}</SignedIn>
    <SignedOut>
      <Navigate to={ROUTES.signIn} replace />
    </SignedOut>
  </>
);

export const PublicRoute = ({ children }: IRouteGuardProps) => (
  <>
    <SignedOut>{children}</SignedOut>
    <SignedIn>
      <Navigate to={ROUTES.dashboard} replace />
    </SignedIn>
  </>
);
