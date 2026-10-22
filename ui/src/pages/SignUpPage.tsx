import { AuthPageShell } from '@/components/auth';
import { ROUTES } from '@/core';
import { SignUpWidget } from '@/service/auth';

export const SignUpPage = () => (
  <AuthPageShell
    brandTo={ROUTES.root}
    footerPrompt="Already have an account?"
    footerLinkTo={ROUTES.signIn}
    footerLinkLabel="Sign in"
  >
    <SignUpWidget />
  </AuthPageShell>
);
