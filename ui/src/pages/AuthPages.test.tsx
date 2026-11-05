import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/renderWithProviders';
import { SignInPage } from './SignInPage';
import { SignUpPage } from './SignUpPage';

vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignedIn: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignIn: (props: { appearance: { elements: { formButtonPrimary: string } } }) => (
    <form
      aria-label="Clerk sign-in form"
      data-appearance-primary={props.appearance.elements.formButtonPrimary}
    >
      <label htmlFor="sign-in-email">Email address</label>
      <input id="sign-in-email" type="email" />
    </form>
  ),
  SignUp: (props: { appearance: { elements: { formButtonPrimary: string } } }) => (
    <form
      aria-label="Clerk sign-up form"
      data-appearance-primary={props.appearance.elements.formButtonPrimary}
    >
      <label htmlFor="sign-up-email">Email address</label>
      <input id="sign-up-email" type="email" />
    </form>
  ),
  UserButton: () => <button aria-label="User menu" />,
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
  useUser: () => ({ isLoaded: true, user: null }),
}));

describe('authentication pages', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('shows Clerk sign-in inside the branded account access shell', () => {
    renderWithProviders(<SignInPage />);

    expect(screen.getByRole('main', { name: 'Account access' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /PrepAI/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('form', { name: 'Clerk sign-in form' })).toHaveAttribute(
      'data-appearance-primary',
      'prepai-auth-primary-button bg-[var(--prepai-accent)] font-semibold text-[var(--accent-foreground)] shadow-none transition hover:bg-[var(--prepai-accent-hover)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.24)]'
    );
  });

  it('shows Clerk sign-up inside the branded account access shell', () => {
    renderWithProviders(<SignUpPage />);

    expect(screen.getByRole('main', { name: 'Account access' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /PrepAI/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('form', { name: 'Clerk sign-up form' })).toHaveAttribute(
      'data-appearance-primary',
      'prepai-auth-primary-button bg-[var(--prepai-accent)] font-semibold text-[var(--accent-foreground)] shadow-none transition hover:bg-[var(--prepai-accent-hover)] hover:shadow-[0_6px_24px_rgba(245,158,11,0.24)]'
    );
  });

  it('restores the saved theme when sign-in is opened directly', () => {
    window.localStorage.setItem('prepai-theme', 'light');

    renderWithProviders(<SignInPage />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('restores the saved theme when sign-up is opened directly', () => {
    window.localStorage.setItem('prepai-theme', 'light');

    renderWithProviders(<SignUpPage />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
});
