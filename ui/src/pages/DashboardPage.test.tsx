import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IUser } from '@/core';
import { DashboardPage } from './DashboardPage';

const serviceMocks = vi.hoisted(() => ({ getMe: vi.fn() }));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: vi.fn(), signOut: vi.fn() }),
  useUser: () => ({
    user: {
      id: 'clerk-user-1',
      firstName: 'Asha',
      emailAddresses: [{ emailAddress: 'asha@example.com' }],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  }),
  UserButton: () => <button aria-label="User menu" />,
}));

vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  getMe: serviceMocks.getMe,
}));

const userProfile = (isNewUser: boolean): IUser => ({
  id: 'user-1',
  clerkUserId: 'clerk-user-1',
  email: 'asha@example.com',
  name: 'Asha',
  role: 'USER',
  isNewUser,
});

const CurrentPath = () => {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
};

const renderDashboard = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/onboarding" element={<h1>Profile setup</h1>} />
        </Routes>
        <CurrentPath />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('DashboardPage first-run routing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends a first-time user to onboarding after loading their profile', async () => {
    serviceMocks.getMe.mockResolvedValue({ success: true, message: 'ok', data: userProfile(true) });

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Profile setup' })).toBeVisible();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/onboarding');
  });

  it('keeps a returning user on the dashboard', async () => {
    serviceMocks.getMe.mockResolvedValue({
      success: true,
      message: 'ok',
      data: userProfile(false),
    });

    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Welcome, Asha' })).toBeVisible();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/dashboard');
  });
});
