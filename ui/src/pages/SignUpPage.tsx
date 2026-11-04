import { AuthPageShell } from '@/components/auth';
import { ROUTES } from '@/core';
import { SignUpWidget } from '@/service/auth';

export const SignUpPage = () => (
  <AuthPageShell brandTo={ROUTES.root}>
    <SignUpWidget />
  </AuthPageShell>
);
