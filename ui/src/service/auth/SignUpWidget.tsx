import { SignUp } from '@clerk/clerk-react';
import { ROUTES } from '@/core';

export const SignUpWidget = () => (
  <SignUp
    routing="path"
    path={ROUTES.signUp}
    appearance={{
      elements: {
        rootBox: 'mx-auto',
        card: 'bg-[#18181b] border border-white/10 shadow-xl',
      },
    }}
  />
);
