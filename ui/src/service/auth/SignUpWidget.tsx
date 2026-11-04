import { SignUp } from '@clerk/clerk-react';
import { ROUTES } from '@/core';
import { authAppearance } from './authAppearance';

export const SignUpWidget = () => (
  <SignUp routing="path" path={ROUTES.signUp} appearance={authAppearance} />
);
