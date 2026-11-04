import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IUser } from '@/core';
import { DashboardPage } from './DashboardPage';

const serviceMocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  getSettings: vi.fn(),
  getTheorySessionHistory: vi.fn(),
  getCodingSessionHistory: vi.fn(),
  getTheoryScoreTrend: vi.fn(),
  getTheoryWeakAreas: vi.fn(),
  getPracticeTopics: vi.fn(),
}));

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
  getSettings: serviceMocks.getSettings,
  getTheorySessionHistory: serviceMocks.getTheorySessionHistory,
  getCodingSessionHistory: serviceMocks.getCodingSessionHistory,
  getTheoryScoreTrend: serviceMocks.getTheoryScoreTrend,
  getTheoryWeakAreas: serviceMocks.getTheoryWeakAreas,
  getPracticeTopics: serviceMocks.getPracticeTopics,
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
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.getSettings.mockResolvedValue({ success: true, message: 'ok', data: null });
    serviceMocks.getTheorySessionHistory.mockResolvedValue({
      success: true,
      message: 'ok',
      data: { sessions: [], total: 0, page: 1, limit: 100 },
    });
    serviceMocks.getCodingSessionHistory.mockResolvedValue({
      success: true,
      message: 'ok',
      data: { sessions: [], total: 0, page: 1, limit: 100 },
    });
    serviceMocks.getTheoryScoreTrend.mockResolvedValue({ success: true, message: 'ok', data: [] });
    serviceMocks.getTheoryWeakAreas.mockResolvedValue({ success: true, message: 'ok', data: [] });
    serviceMocks.getPracticeTopics.mockResolvedValue({ success: true, message: 'ok', data: [] });
  });

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

    expect(
      await screen.findByRole('heading', { name: /Good (morning|afternoon|evening), Asha/ })
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Recent Sessions' })).toBeVisible();
    expect(await screen.findByText('No sessions yet')).toBeVisible();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/dashboard');
  });

  it('shows theory history failures with a retry while keeping independent dashboard panels visible', async () => {
    serviceMocks.getMe.mockResolvedValue({
      success: true,
      message: 'ok',
      data: userProfile(false),
    });
    serviceMocks.getTheorySessionHistory
      .mockRejectedValueOnce(new Error('History service unavailable'))
      .mockResolvedValue({
        success: true,
        message: 'ok',
        data: { sessions: [], total: 0, page: 1, limit: 100 },
      });

    renderDashboard();

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((alert) => alert.textContent?.includes('History service unavailable'))).toBe(
      true
    );
    expect(screen.getByRole('heading', { name: 'Weak Areas' })).toBeVisible();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry recent sessions' }));
    expect(await screen.findByText('No sessions yet')).toBeVisible();
    expect(serviceMocks.getTheorySessionHistory).toHaveBeenCalledTimes(2);
  });
});
