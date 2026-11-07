import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticatedLayoutPage } from './AuthenticatedLayoutPage';

const state = vi.hoisted(() => ({
  toggleTheme: vi.fn(),
}));

vi.mock('@/logic', () => ({
  useGlobalSearch: () => ({ results: [], isLoading: false, errorMessage: null, retry: vi.fn() }),
  useSessionReader: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: { id: 'clerk-1', firstName: 'Asha', email: 'asha@example.com', createdAt: null },
  }),
  useThemePreference: () => ({ theme: 'dark', toggleTheme: state.toggleTheme }),
}));

vi.mock('@/service/auth', () => ({
  UserMenu: () => <button aria-label="Clerk user menu">Account</button>,
}));

vi.mock('./StudyChatWidget', () => ({
  StudyChatWidget: () => <button aria-label="Study Chat assistant launcher">Ask PrepAI</button>,
}));

vi.mock('./NotificationCenter', () => ({
  NotificationCenter: () => <button aria-label="Notifications">Notifications</button>,
}));

const CurrentPath = () => {
  const location = useLocation();
  return (
    <output aria-label="Current route">
      {location.pathname}
      {location.search}
    </output>
  );
};

const renderAuthenticatedRoutes = (initialPath = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AuthenticatedLayoutPage />}>
          <Route path="/dashboard" element={<h2>Dashboard route content</h2>} />
          <Route path="/practice" element={<h2>Practice route content</h2>} />
          <Route path="/coding" element={<h2>Coding route content</h2>} />
          <Route path="/coding/:problemId" element={<h2>Coding problem route content</h2>} />
          <Route path="/history" element={<h2>History route content</h2>} />
          <Route path="/history/:sessionId" element={<h2>Session detail route content</h2>} />
          <Route path="/settings" element={<h2>Settings route content</h2>} />
          <Route path="/library" element={<h2>Library route content</h2>} />
        </Route>
      </Routes>
      <CurrentPath />
    </MemoryRouter>
  );

describe('AuthenticatedLayoutPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the route title and active navigation in sync as the URL changes', async () => {
    const user = userEvent.setup();
    renderAuthenticatedRoutes();

    expect(within(screen.getByRole('banner')).getByText('Dashboard')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Clerk user menu' })).toBeVisible();
    expect(screen.getByText('asha@example.com')).toBeVisible();

    await user.click(screen.getByRole('link', { name: 'Settings' }));

    expect(await within(screen.getByRole('banner')).findByText('Settings')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/settings');
  });

  it.each([
    ['Dashboard', '/dashboard', 'Dashboard route content'],
    ['Practice', '/practice', 'Practice route content'],
    ['Coding', '/coding', 'Coding route content'],
    ['History', '/history', 'History route content'],
    ['Settings', '/settings', 'Settings route content'],
  ])('replaces Library content when navigating to %s', async (label, path, expectedContent) => {
    const user = userEvent.setup();
    renderAuthenticatedRoutes('/library');

    expect(screen.getByRole('heading', { name: 'Library route content' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: label }));

    expect(await screen.findByRole('heading', { name: expectedContent })).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Library route content' })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
  });

  it('routes theme changes through the existing theme preference', async () => {
    const user = userEvent.setup();
    renderAuthenticatedRoutes();

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));

    expect(state.toggleTheme).toHaveBeenCalledOnce();
  });

  it('opens Plan and billing from the sidebar shortcut', async () => {
    const user = userEvent.setup();
    renderAuthenticatedRoutes();

    await user.click(screen.getByRole('button', { name: 'Plan & billing' }));

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/settings?tab=plan');
  });

  it('shows the dashboard New Session action and opens Practice', async () => {
    const user = userEvent.setup();
    renderAuthenticatedRoutes('/dashboard');

    await user.click(screen.getByRole('button', { name: 'New Session' }));

    expect(screen.getByLabelText('Current route')).toHaveTextContent('/practice');
  });

  it('keeps the dashboard-only New Session action off other routes', () => {
    renderAuthenticatedRoutes('/practice');

    expect(screen.queryByRole('button', { name: 'New Session' })).not.toBeInTheDocument();
  });

  it('mounts exactly one Study Chat launcher beside the authenticated route content', () => {
    renderAuthenticatedRoutes('/dashboard');

    expect(screen.getAllByRole('button', { name: 'Study Chat assistant launcher' })).toHaveLength(
      1
    );
    expect(screen.getByRole('heading', { name: 'Dashboard route content' })).toBeVisible();
  });

  it('marks Practice active and updates the page title for its route', () => {
    renderAuthenticatedRoutes('/practice');

    expect(within(screen.getByRole('banner')).getByText('Practice')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Practice' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Practice route content' })).toBeVisible();
  });

  it.each(['/coding', '/coding/two-sum'])(
    'marks Coding active and updates the page title for %s',
    (path) => {
      renderAuthenticatedRoutes(path);

      expect(within(screen.getByRole('banner')).getByText('Coding')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Coding' })).toHaveAttribute('aria-current', 'page');
      expect(
        screen.getByRole('heading', {
          name: /Coding route content|Coding problem route content/,
        })
      ).toBeVisible();
    }
  );

  it.each(['/history', '/history/session-one'])(
    'marks History active and updates the page title for %s',
    (path) => {
      renderAuthenticatedRoutes(path);

      expect(within(screen.getByRole('banner')).getByText('History')).toBeVisible();
      expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
      expect(
        screen.getByRole('heading', { name: /History route content|Session detail route content/ })
      ).toBeVisible();
      expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
    }
  );

  it('uses the same case-insensitive route match as React Router', () => {
    renderAuthenticatedRoutes('/Settings');

    expect(within(screen.getByRole('banner')).getByText('Settings')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });
});
