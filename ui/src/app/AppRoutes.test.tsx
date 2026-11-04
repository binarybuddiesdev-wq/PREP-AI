import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocation } from 'react-router';

import { renderWithProviders } from '@/test/renderWithProviders';

import { AppRoutes } from './AppRoutes';

const authenticationState = vi.hoisted(() => ({ isSignedIn: false }));

vi.mock('@/service/auth', () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) =>
    authenticationState.isSignedIn ? children : null,
  SignedOut: ({ children }: { children: React.ReactNode }) =>
    authenticationState.isSignedIn ? null : children,
  SignInWidget: () => null,
  SignUpWidget: () => null,
  UserMenu: () => <button aria-label="Clerk user menu">Account</button>,
}));

vi.mock('@/logic', () => ({
  useSessionReader: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: { id: 'user-1', firstName: 'Asha', email: 'asha@example.com' },
  }),
  useThemePreference: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

vi.mock('@/pages', async (importOriginal) => {
  const pages = await importOriginal<typeof import('@/pages')>();
  return {
    ...pages,
    DashboardPage: () => <h1>Authenticated dashboard</h1>,
    PracticePage: () => <h1>Authenticated practice</h1>,
    SessionHistoryPage: () => <h1>Authenticated session history</h1>,
    TheorySessionDetailPage: () => <h1>Authenticated session detail</h1>,
    OnboardingPage: () => <h1>Authenticated onboarding</h1>,
    SettingsPage: () => <h1>Authenticated settings</h1>,
    SettingsDocumentsPage: () => <h1>Authenticated documents</h1>,
    LibraryPage: () => <h1>Authenticated Library</h1>,
  };
});

const CurrentPath = () => {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
};

describe('AppRoutes', () => {
  beforeEach(() => {
    authenticationState.isSignedIn = false;
  });

  afterEach(() => vi.restoreAllMocks());

  it('serves the landing page at the public root route', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    renderWithProviders(<AppRoutes />, ['/']);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /the smarter way to.*prepare for interviews/i
    );
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getByRole('link', { name: 'Start Free' })).toHaveAttribute('href', '/sign-up');
  });

  it('redirects signed-in users from the root route to their dashboard', () => {
    authenticationState.isSignedIn = true;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/']
    );

    expect(screen.getByRole('heading', { name: 'Authenticated dashboard' })).toBeInTheDocument();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/dashboard');
  });

  it('shows onboarding to signed-in users on the setup route', () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/onboarding']
    );

    expect(screen.getByRole('heading', { name: 'Authenticated onboarding' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Primary navigation')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/onboarding');
  });

  it('serves settings inside the authenticated route group', () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/settings']
    );

    expect(screen.getByRole('heading', { name: 'Authenticated settings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/settings');
  });

  it('serves settings documents inside the authenticated route group', () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/settings/documents']
    );

    expect(screen.getByRole('heading', { name: 'Authenticated documents' })).toBeInTheDocument();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/settings/documents');
  });

  it('serves the Library inside the authenticated route group', () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/library']
    );

    expect(screen.getByRole('heading', { name: 'Authenticated Library' })).toBeInTheDocument();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/library');
  });

  it('serves Practice inside the authenticated route group', () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/practice']
    );

    expect(screen.getByRole('heading', { name: 'Authenticated practice' })).toBeInTheDocument();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/practice');
  });

  it('serves a shareable session detail URL inside the authenticated route group', () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/history/session-one']
    );

    expect(screen.getByRole('heading', { name: 'Authenticated session detail' })).toBeVisible();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/history/session-one');
  });

  it('serves session history inside the authenticated route group', () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/history']
    );

    expect(screen.getByRole('heading', { name: 'Authenticated session history' })).toBeVisible();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/history');
  });

  it('redirects signed-out users away from session details', () => {
    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/history/session-one']
    );

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/sign-in');
  });

  it('redirects signed-out users away from the setup route', () => {
    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/onboarding']
    );

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/sign-in');
  });

  it('redirects signed-out users away from Practice', () => {
    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/practice']
    );

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/sign-in');
  });
});
