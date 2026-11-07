import { screen, waitFor } from '@testing-library/react';
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
  useGlobalSearch: () => ({ results: [], isLoading: false, errorMessage: null, retry: vi.fn() }),
  useSessionReader: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: { id: 'user-1', firstName: 'Asha', email: 'asha@example.com' },
  }),
  useThemePreference: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

vi.mock('@/pages/StudyChatWidget', () => ({
  StudyChatWidget: () => <button aria-label="Study Chat assistant launcher">Ask PrepAI</button>,
}));

vi.mock('@/pages/NotificationCenter', () => ({
  NotificationCenter: () => <button aria-label="Notifications">Notifications</button>,
}));

vi.mock('@/pages/AuthenticatedLayoutPage', async () => {
  const { Outlet } = await import('react-router');
  return {
    AuthenticatedLayoutPage: () => (
      <>
        <nav aria-label="Primary navigation" />
        <Outlet />
      </>
    ),
  };
});
vi.mock('@/pages/CodingPage', () => ({
  CodingPage: () => <h1>Authenticated coding catalogue</h1>,
}));
vi.mock('@/pages/CodingProblemPage', () => ({
  CodingProblemPage: () => <h1>Authenticated coding problem</h1>,
}));
vi.mock('@/pages/DashboardPage', () => ({ DashboardPage: () => <h1>Authenticated dashboard</h1> }));
vi.mock('@/pages/LibraryPage', () => ({ LibraryPage: () => <h1>Authenticated Library</h1> }));
vi.mock('@/pages/OnboardingPage', () => ({
  OnboardingPage: () => <h1>Authenticated onboarding</h1>,
}));
vi.mock('@/pages/PracticePage', () => ({ PracticePage: () => <h1>Authenticated practice</h1> }));
vi.mock('@/pages/SettingsPage', () => ({ SettingsPage: () => <h1>Authenticated settings</h1> }));
vi.mock('@/pages/SettingsDocumentsPage', () => ({
  SettingsDocumentsPage: () => <h1>Authenticated documents</h1>,
}));
vi.mock('@/pages/SessionHistoryPage', () => ({
  SessionHistoryPage: () => <h1>Authenticated session history</h1>,
}));
vi.mock('@/pages/TheorySessionDetailPage', () => ({
  TheorySessionDetailPage: () => <h1>Authenticated session detail</h1>,
}));

const CurrentPath = () => {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
};

describe('AppRoutes', () => {
  beforeEach(() => {
    authenticationState.isSignedIn = false;
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['/coding', 'Authenticated coding catalogue'],
    ['/coding/two-sum', 'Authenticated coding problem'],
  ])('serves the protected coding route %s', async (path, heading) => {
    authenticationState.isSignedIn = true;
    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      [path]
    );

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
  });

  it('serves the landing page at the public root route', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    renderWithProviders(<AppRoutes />, ['/']);

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /the smarter way to.*prepare for interviews/i
    );
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getByRole('link', { name: 'Start Free' })).toHaveAttribute('href', '/sign-up');
    expect(
      screen.queryByRole('button', { name: 'Study Chat assistant launcher' })
    ).not.toBeInTheDocument();
  });

  it('redirects signed-in users from the root route to their dashboard', async () => {
    authenticationState.isSignedIn = true;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/']
    );

    expect(
      await screen.findByRole('heading', { name: 'Authenticated dashboard' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/dashboard');
  });

  it('shows onboarding to signed-in users on the setup route', async () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/onboarding']
    );

    expect(
      await screen.findByRole('heading', { name: 'Authenticated onboarding' })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Primary navigation')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/onboarding');
  });

  it('serves settings inside the authenticated route group', async () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/settings']
    );

    expect(
      await screen.findByRole('heading', { name: 'Authenticated settings' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/settings');
  });

  it('serves settings documents inside the authenticated route group', async () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/settings/documents']
    );

    expect(
      await screen.findByRole('heading', { name: 'Authenticated documents' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/settings/documents');
  });

  it('serves the Library inside the authenticated route group', async () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/library']
    );

    expect(
      await screen.findByRole('heading', { name: 'Authenticated Library' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/library');
  });

  it('serves Practice inside the authenticated route group', async () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/practice']
    );

    expect(
      await screen.findByRole('heading', { name: 'Authenticated practice' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/practice');
  });

  it('serves a shareable session detail URL inside the authenticated route group', async () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/history/session-one']
    );

    expect(
      await screen.findByRole('heading', { name: 'Authenticated session detail' })
    ).toBeVisible();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/history/session-one');
  });

  it('serves session history inside the authenticated route group', async () => {
    authenticationState.isSignedIn = true;

    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/history']
    );

    expect(
      await screen.findByRole('heading', { name: 'Authenticated session history' })
    ).toBeVisible();
    expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/history');
  });

  it('redirects signed-out users away from session details', async () => {
    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/history/session-one']
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/sign-in')
    );
  });

  it('redirects signed-out users away from the setup route', async () => {
    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/onboarding']
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/sign-in')
    );
  });

  it('redirects signed-out users away from Practice', async () => {
    renderWithProviders(
      <>
        <AppRoutes />
        <CurrentPath />
      </>,
      ['/practice']
    );

    await waitFor(() =>
      expect(screen.getByLabelText('Current route')).toHaveTextContent('/sign-in')
    );
  });
});
