import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HTTPError } from 'ky';
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
  getCodingProblems: vi.fn(),
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
  getCodingProblems: serviceMocks.getCodingProblems,
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
          <Route path="/history/:sessionId" element={<h1>Selected session details</h1>} />
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
    serviceMocks.getCodingProblems.mockResolvedValue({ success: true, message: 'ok', data: [] });
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

  it('opens the matching saved session from the dashboard', async () => {
    const user = userEvent.setup();
    serviceMocks.getMe.mockResolvedValue({
      success: true,
      message: 'ok',
      data: userProfile(false),
    });
    serviceMocks.getTheorySessionHistory.mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        sessions: [
          {
            id: 'session-one',
            topicId: 'topic-react',
            mode: 'topic',
            difficulty: 'Mid',
            totalQuestions: 10,
            questionsAnswered: 8,
            avgScore: 7.5,
            status: 'completed',
            startedAt: '2026-11-01T10:00:00.000Z',
            completedAt: '2026-11-01T10:20:00.000Z',
            createdAt: '2026-11-01T10:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 100,
      },
    });
    serviceMocks.getPracticeTopics.mockResolvedValue({
      success: true,
      message: 'ok',
      data: [
        {
          id: 'topic-react',
          name: 'React',
          slug: 'react',
          category: 'practice',
          icon: null,
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
        },
      ],
    });

    renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'View React session' }));

    expect(await screen.findByRole('heading', { name: 'Selected session details' })).toBeVisible();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/history/session-one');
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

  it('explains a profile API 500 as a server failure and keeps retry available', async () => {
    const user = userEvent.setup();
    const error = new HTTPError(
      new Response(JSON.stringify({ message: 'Internal server error' }), { status: 500 }),
      new Request('http://api.test/api/v1/users/me'),
      {} as never
    );
    error.message = 'Internal server error';
    serviceMocks.getMe.mockRejectedValue(error);

    renderDashboard();

    expect(
      await screen.findByRole('heading', { name: "Couldn't load your profile" })
    ).toBeVisible();
    expect(
      screen.getByText(
        'The server returned an internal error while loading your profile. Try again shortly.'
      )
    ).toBeVisible();
    expect(screen.getByText('HTTP 500: Internal server error')).toBeVisible();
    expect(screen.getByRole('link', { name: /start practice/i })).toHaveAttribute(
      'href',
      '/practice'
    );
    expect(screen.getByRole('link', { name: /solve coding problems/i })).toHaveAttribute(
      'href',
      '/coding'
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(serviceMocks.getMe).toHaveBeenCalledTimes(2);
  });
});
