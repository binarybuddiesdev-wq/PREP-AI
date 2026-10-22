import { SignIn } from '@clerk/clerk-react';
import { ROUTES } from '@/core';

export const SignInWidget = () => (
  <SignIn
    routing="path"
    path={ROUTES.signIn}
    appearance={{
      elements: {
        rootBox: 'mx-auto',
        card: 'bg-[#18181b] border border-white/10 shadow-xl',
      },
    }}
  />
);
