import { AuthPageShell } from '@/components/auth';
import { ROUTES } from '@/core';
import { SignInWidget } from '@/service/auth';

export const SignInPage = () => (
  <AuthPageShell
    brandTo={ROUTES.root}
    footerPrompt="Don't have an account?"
    footerLinkTo={ROUTES.signUp}
    footerLinkLabel="Sign up"
  >
    <SignInWidget />
  </AuthPageShell>
);
