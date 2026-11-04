import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/renderWithProviders';
import { SignInPage } from './SignInPage';
import { SignUpPage } from './SignUpPage';

vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignedIn: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignIn: () => (
    <form aria-label="Clerk sign-in form">
      <label htmlFor="sign-in-email">Email address</label>
      <input id="sign-in-email" type="email" />
    </form>
  ),
  SignUp: () => (
    <form aria-label="Clerk sign-up form">
      <label htmlFor="sign-up-email">Email address</label>
      <input id="sign-up-email" type="email" />
    </form>
  ),
  UserButton: () => <button aria-label="User menu" />,
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
  useUser: () => ({ isLoaded: true, user: null }),
}));

describe('authentication pages', () => {
  it('shows Clerk sign-in inside the branded account access shell', () => {
    renderWithProviders(<SignInPage />);

    expect(screen.getByRole('main', { name: 'Account access' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /PrepAI/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('form', { name: 'Clerk sign-in form' })).toBeInTheDocument();
  });

  it('shows Clerk sign-up inside the branded account access shell', () => {
    renderWithProviders(<SignUpPage />);

    expect(screen.getByRole('main', { name: 'Account access' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /PrepAI/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('form', { name: 'Clerk sign-up form' })).toBeInTheDocument();
  });
});
