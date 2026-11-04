import { AuthPageShell } from '@/components/auth';
import { ROUTES } from '@/core';
import { SignInWidget } from '@/service/auth';

export const SignInPage = () => (
  <AuthPageShell brandTo={ROUTES.root}>
    <SignInWidget />
  </AuthPageShell>
);
