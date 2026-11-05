import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticatedLayoutPage } from './AuthenticatedLayoutPage';

const state = vi.hoisted(() => ({
  toggleTheme: vi.fn(),
}));

vi.mock('@/logic', () => ({
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

const CurrentPath = () => {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
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
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Clerk user menu' })).toBeVisible();
    expect(screen.getByText('asha@example.com')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(await within(screen.getByRole('banner')).findByText('Settings')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/settings');
  });

  it('routes theme changes through the existing theme preference', async () => {
    const user = userEvent.setup();
    renderAuthenticatedRoutes();

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));

    expect(state.toggleTheme).toHaveBeenCalledOnce();
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
    expect(screen.getByRole('button', { name: 'Practice' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('heading', { name: 'Practice route content' })).toBeVisible();
  });

  it.each(['/coding', '/coding/two-sum'])(
    'marks Coding active and updates the page title for %s',
    (path) => {
      renderAuthenticatedRoutes(path);

      expect(within(screen.getByRole('banner')).getByText('Coding')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Coding' })).toHaveAttribute(
        'aria-current',
        'page'
      );
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
      expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(
        screen.getByRole('heading', { name: /History route content|Session detail route content/ })
      ).toBeVisible();
      expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
    }
  );

  it('uses the same case-insensitive route match as React Router', () => {
    renderAuthenticatedRoutes('/Settings');

    expect(within(screen.getByRole('banner')).getByText('Settings')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
