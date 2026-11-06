import { AuthPageShell } from '@/components/auth';
import { ROUTES } from '@/core';
import { useThemePreference } from '@/logic';
import { SignInWidget } from '@/service/auth';

export const SignInPage = () => {
  useThemePreference();

  return (
    <AuthPageShell brandTo={ROUTES.root} mode="sign-in">
      <SignInWidget />
    </AuthPageShell>
  );
};
