import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from './AppProviders';
import { AppRoutes } from './AppRoutes';

const auth = vi.hoisted(() => ({ isSignedIn: true }));
const practiceRoute = vi.hoisted(() => ({
  isPending: false,
  pending: null as Promise<void> | null,
}));

vi.mock('@/service/auth', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  SignedIn: ({ children }: { children: React.ReactNode }) => (auth.isSignedIn ? children : null),
  SignedOut: ({ children }: { children: React.ReactNode }) => (auth.isSignedIn ? null : children),
  UserMenu: () => (
    <button type="button" aria-label="Account menu">
      Account
    </button>
  ),
}));

vi.mock('@/logic', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return {
    createQueryClient: () => new QueryClient(),
    useGlobalSearch: () => ({ results: [], isLoading: false, errorMessage: null, retry: vi.fn() }),
    useSessionReader: () => ({
      isLoaded: true,
      isSignedIn: true,
      user: { id: 'user-one', firstName: 'Asha', email: 'asha@example.com' },
    }),
    useThemePreference: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
  };
});

vi.mock('@/pages/StudyChatWidget', () => ({
  StudyChatWidget: () => <button type="button">Ask PrepAI</button>,
}));
vi.mock('@/pages/NotificationCenter', () => ({
  NotificationCenter: () => <button type="button">Notifications</button>,
}));
vi.mock('@/pages/CodingPage', () => ({ CodingPage: () => <h1>Coding route content</h1> }));
vi.mock('@/pages/CodingProblemPage', () => ({
  CodingProblemPage: () => <h1>Coding problem route content</h1>,
}));
vi.mock('@/pages/DashboardPage', () => ({ DashboardPage: () => <h1>Dashboard route content</h1> }));
vi.mock('@/pages/LibraryPage', () => ({ LibraryPage: () => <h1>Library route content</h1> }));
vi.mock('@/pages/PracticePage', () => ({
  PracticePage: () => {
    if (practiceRoute.isPending && practiceRoute.pending) throw practiceRoute.pending;
    return <h1>Practice route content</h1>;
  },
}));
vi.mock('@/pages/SessionHistoryPage', () => ({
  SessionHistoryPage: () => <h1>History route content</h1>,
}));
vi.mock('@/pages/SettingsPage', () => ({ SettingsPage: () => <h1>Settings route content</h1> }));
vi.mock('@/pages/SettingsDocumentsPage', () => ({
  SettingsDocumentsPage: () => <h1>Documents route content</h1>,
}));
vi.mock('@/pages/TheorySessionDetailPage', () => ({
  TheorySessionDetailPage: () => <h1>Session detail route content</h1>,
}));

const CurrentPath = () => {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
};

const renderApplication = (initialPath: string) =>
  (() => {
    window.history.replaceState({}, '', initialPath);
    return render(
      <AppProviders>
        <AppRoutes />
        <CurrentPath />
      </AppProviders>
    );
  })();

describe('AppRoutes sidebar navigation', () => {
  beforeEach(() => {
    auth.isSignedIn = true;
    practiceRoute.isPending = false;
    practiceRoute.pending = null;
  });

  it('shows a loading state instead of leaving Library visible while a destination is loading', async () => {
    const user = userEvent.setup();
    let resolveDestination: (() => void) | undefined;
    const pendingDestination = new Promise<void>((resolve) => {
      resolveDestination = resolve;
    });
    practiceRoute.pending = pendingDestination;
    practiceRoute.isPending = true;
    renderApplication('/library');

    try {
      await user.click(await screen.findByRole('link', { name: 'Practice' }));
      expect(await screen.findByText('Loading practice...')).toBeVisible();
      expect(screen.getByRole('complementary', { name: 'Primary navigation' })).toBeVisible();
      expect(
        screen.queryByRole('heading', { name: 'Library route content' })
      ).not.toBeInTheDocument();
    } finally {
      await act(async () => {
        practiceRoute.isPending = false;
        resolveDestination?.();
        await pendingDestination;
      });
    }

    expect(await screen.findByRole('heading', { name: 'Practice route content' })).toBeVisible();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/practice');
  });

  it.each([
    ['Dashboard', '/dashboard', 'Dashboard route content'],
    ['Practice', '/practice', 'Practice route content'],
    ['Coding', '/coding', 'Coding route content'],
    ['History', '/history', 'History route content'],
    ['Settings', '/settings', 'Settings route content'],
  ])(
    'moves from the Library route to %s and replaces the Outlet screen',
    async (label, path, content) => {
      const user = userEvent.setup();
      renderApplication('/library');

      expect(await screen.findByRole('heading', { name: 'Library route content' })).toBeVisible();
      await user.click(screen.getByRole('link', { name: label }));

      expect(await screen.findByRole('heading', { name: content })).toBeVisible();
      expect(
        screen.queryByRole('heading', { name: 'Library route content' })
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('banner')).toHaveTextContent(label);
    }
  );
});
