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

  it('marks Practice active and updates the page title for its route', () => {
    renderAuthenticatedRoutes('/practice');

    expect(within(screen.getByRole('banner')).getByText('Practice')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Practice' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('heading', { name: 'Practice route content' })).toBeVisible();
  });

  it('uses the same case-insensitive route match as React Router', () => {
    renderAuthenticatedRoutes('/Settings');

    expect(within(screen.getByRole('banner')).getByText('Settings')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
