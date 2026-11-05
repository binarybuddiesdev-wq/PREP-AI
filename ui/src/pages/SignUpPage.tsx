import { AuthPageShell } from '@/components/auth';
import { ROUTES } from '@/core';
import { useThemePreference } from '@/logic';
import { SignUpWidget } from '@/service/auth';

export const SignUpPage = () => {
  useThemePreference();

  return (
    <AuthPageShell brandTo={ROUTES.root}>
      <SignUpWidget />
    </AuthPageShell>
  );
};
