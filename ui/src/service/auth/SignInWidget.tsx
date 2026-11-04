import { SignIn } from '@clerk/clerk-react';
import { ROUTES } from '@/core';
import { authAppearance } from './authAppearance';

export const SignInWidget = () => (
  <SignIn routing="path" path={ROUTES.signIn} appearance={authAppearance} />
);
