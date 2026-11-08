import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingsPage } from './SettingsPage';
import { renderWithProviders } from '@/test/renderWithProviders';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: async () => null,
    signOut: vi.fn(),
  }),
  useUser: () => ({
    user: {
      id: 'user_test',
      firstName: 'Asha',
      lastName: 'Rao',
      emailAddresses: [{ emailAddress: 'asha@example.com' }],
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      update: clerkUpdateMock,
    },
  }),
}));

const clerkUpdateMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

describe('SettingsPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  const userProfile = {
    id: 'mongo-user-1',
    clerkUserId: 'user_test',
    email: 'asha@example.com',
    name: 'Asha Rao',
    role: 'USER',
    isNewUser: false,
  };
  const userSettings = {
    id: 'settings-1',
    userId: 'mongo-user-1',
    profile: { targetRole: 'Backend', experienceLevel: 'Senior', targetCompanies: 'Google' },
    preferences: {
      preferredTopics: ['React', 'TypeScript'],
      defaultDifficulty: 'Mid',
      onboardingStep: 3,
    },
    notifications: { dailyReminder: false, email: false },
    dailyReminderEnabled: false,
    dailyReminderTime: '19:00',
    timezone: 'Asia/Kolkata',
  };

  const renderSettingsPage = (initialEntry = '/settings') => {
    return renderWithProviders(<SettingsPage />, [initialEntry], { includeToastViewport: true });
  };

  it('shows a retryable message when profile and settings requests fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Unauthorized', { status: 401 }))
    );
    renderWithProviders(<SettingsPage />, ['/settings'], { includeToastViewport: true });

    const errorAlert = await screen.findByText(/Couldn.t load your profile/);
    expect(errorAlert).toHaveTextContent('Couldn’t load your profile');
    expect(errorAlert.closest('main')).not.toHaveClass('min-h-screen');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows only supported settings and saves the existing profile and preference data', async () => {
    const patchBodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        if (request.url.endsWith('/users/me')) {
          return Response.json({ success: true, message: 'ok', data: userProfile });
        }
        if (request.method === 'PATCH') {
          patchBodies.push(await request.clone().json());
          return Response.json({ success: true, message: 'ok', data: userSettings });
        }
        if (request.url.endsWith('/users/settings')) {
          return Response.json({ success: true, message: 'ok', data: userSettings });
        }
        return Response.json({ success: false, message: 'Not found' }, { status: 404 });
      })
    );
    const user = userEvent.setup();
    renderSettingsPage();

    expect(await screen.findByRole('textbox', { name: 'First Name' })).toHaveValue('Asha');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeVisible();
    expect(screen.getByText('Manage your profile and preferences')).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.queryByText(/weekly report|AI model|reset all progress/i)
    ).not.toBeInTheDocument();
    await user.clear(screen.getByRole('textbox', { name: 'Target companies' }));
    await user.type(screen.getByRole('textbox', { name: 'Target companies' }), 'Stripe, Acme');
    await user.click(screen.getByRole('tab', { name: 'Notifications' }));
    await user.click(screen.getByRole('switch', { name: 'Daily Practice Reminder' }));
    await user.clear(screen.getByRole('textbox', { name: 'Time zone' }));
    await user.type(screen.getByRole('textbox', { name: 'Time zone' }), 'Europe/London');
    await user.click(screen.getByRole('tab', { name: 'Profile' }));
    expect(screen.getByRole('textbox', { name: 'Target companies' })).toHaveValue('Stripe, Acme');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(patchBodies).toHaveLength(1));
    expect(patchBodies[0]).toMatchObject({
      profile: { targetRole: 'Backend Engineer', targetCompanies: 'Stripe, Acme' },
      preferences: { onboardingStep: 3, preferredTopics: ['React', 'TypeScript'] },
      notifications: { dailyReminder: true, email: true, timezone: 'Europe/London' },
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Settings saved successfully');
  });

  it('saves changed first and last names to Clerk and leaves names out of the settings API body', async () => {
    const patchBodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        if (request.url.endsWith('/users/me')) {
          return Response.json({ success: true, message: 'ok', data: userProfile });
        }
        if (request.method === 'PATCH') {
          patchBodies.push(await request.clone().json());
          return Response.json({ success: true, message: 'ok', data: userSettings });
        }
        if (request.url.endsWith('/users/settings')) {
          return Response.json({ success: true, message: 'ok', data: userSettings });
        }
        return Response.json({ success: false, message: 'Not found' }, { status: 404 });
      })
    );
    clerkUpdateMock.mockClear();
    const user = userEvent.setup();
    renderSettingsPage();

    const firstName = await screen.findByRole('textbox', { name: 'First Name' });
    await user.clear(firstName);
    await user.type(firstName, 'Mira');
    const lastName = screen.getByRole('textbox', { name: 'Last Name' });
    await user.clear(lastName);
    await user.type(lastName, 'Shah');
    const targetCompanies = screen.getByRole('textbox', { name: 'Target companies' });
    await user.clear(targetCompanies);
    await user.type(targetCompanies, 'Mira Systems');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(clerkUpdateMock).toHaveBeenCalledWith({ firstName: 'Mira', lastName: 'Shah' })
    );
    await waitFor(() => expect(patchBodies).toHaveLength(1));
    expect(patchBodies[0]).not.toHaveProperty('firstName');
    expect(patchBodies[0]).not.toHaveProperty('lastName');
    expect(patchBodies[0]).toMatchObject({ profile: { targetCompanies: 'Mira Systems' } });
    expect(await screen.findByRole('status')).toHaveTextContent('Settings saved successfully');
  });

  it('updates only Clerk when the name is the only changed profile field', async () => {
    const requests: Request[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        requests.push(request);
        if (request.url.endsWith('/users/me')) {
          return Response.json({ success: true, message: 'ok', data: userProfile });
        }
        return Response.json({ success: true, message: 'ok', data: userSettings });
      })
    );
    clerkUpdateMock.mockClear();
    const user = userEvent.setup();
    renderSettingsPage();

    const firstName = await screen.findByRole('textbox', { name: 'First Name' });
    await user.clear(firstName);
    await user.type(firstName, 'Mira');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() =>
      expect(clerkUpdateMock).toHaveBeenCalledWith({ firstName: 'Mira', lastName: 'Rao' })
    );
    expect(requests.some((request) => request.method === 'PATCH')).toBe(false);
    expect(await screen.findByRole('status')).toHaveTextContent('Settings saved successfully');
  });

  it('shows a Clerk update error and does not save settings when the identity update fails', async () => {
    const requests: Request[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        requests.push(request);
        if (request.url.endsWith('/users/me')) {
          return Response.json({ success: true, message: 'ok', data: userProfile });
        }
        if (request.url.endsWith('/users/settings')) {
          return Response.json({ success: true, message: 'ok', data: userSettings });
        }
        return Response.json({ success: true, message: 'ok', data: userSettings });
      })
    );
    clerkUpdateMock.mockRejectedValueOnce(new Error('Name update was rejected by Clerk'));
    const user = userEvent.setup();
    renderSettingsPage();

    const firstName = await screen.findByRole('textbox', { name: 'First Name' });
    await user.clear(firstName);
    await user.type(firstName, 'Mira');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    const alerts = await screen.findAllByRole('alert');
    expect(
      alerts.some((alert) => alert.textContent?.includes('Name update was rejected by Clerk'))
    ).toBe(true);
    expect(requests.some((request) => request.method === 'PATCH')).toBe(false);
    expect(screen.getByRole('textbox', { name: 'First Name' })).toHaveValue('Mira');
  });

  it('loads plan and usage data only after the Plan tab is opened', async () => {
    const patchBodies: unknown[] = [];
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        requestedUrls.push(request.url);
        if (request.url.endsWith('/users/me')) {
          return Response.json({ success: true, message: 'ok', data: userProfile });
        }
        if (request.method === 'PATCH') {
          patchBodies.push(await request.clone().json());
          return Response.json({ success: true, message: 'ok', data: userSettings });
        }
        if (request.url.endsWith('/users/settings')) {
          return Response.json({ success: true, message: 'ok', data: userSettings });
        }
        if (request.url.endsWith('/theory/stats')) {
          return Response.json({
            success: true,
            message: 'ok',
            data: { dailySessions: { used: 1, limit: 3 }, questionsPerSession: 5 },
          });
        }
        if (request.url.endsWith('/coding/stats')) {
          return Response.json({
            success: true,
            message: 'ok',
            data: {
              solvedProblems: 2,
              currentStreak: 1,
              dailySolved: { used: 2, limit: 5 },
              dailyReviews: { used: 1, limit: 2 },
            },
          });
        }
        if (request.url.endsWith('/payments/subscriptions/current')) {
          return Response.json({ success: true, message: 'ok', data: null });
        }
        return Response.json({ success: false, message: 'Not found' }, { status: 404 });
      })
    );
    const user = userEvent.setup();
    renderSettingsPage();

    await screen.findByRole('textbox', { name: 'First Name' });
    expect(requestedUrls.some((url) => /\/(theory|coding)\/stats$/.test(url))).toBe(false);
    expect(requestedUrls.some((url) => url.endsWith('/payments/subscriptions/current'))).toBe(
      false
    );

    await user.click(screen.getByRole('tab', { name: 'Plan' }));
    await screen.findByText('Practice Sessions');

    await waitFor(() => {
      expect(requestedUrls.some((url) => url.endsWith('/theory/stats'))).toBe(true);
      expect(requestedUrls.some((url) => url.endsWith('/coding/stats'))).toBe(true);
      expect(requestedUrls.some((url) => url.endsWith('/payments/subscriptions/current'))).toBe(
        true
      );
    });
  });

  it('loads PDF sources only on AI & Sources and saves the selected source IDs', async () => {
    const requestedUrls: string[] = [];
    const patchBodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        requestedUrls.push(request.url);
        if (request.url.endsWith('/users/me')) {
          return Response.json({ success: true, message: 'ok', data: userProfile });
        }
        if (request.method === 'PATCH') {
          patchBodies.push(await request.clone().json());
          return Response.json({ success: true, message: 'ok', data: userSettings });
        }
        if (request.url.endsWith('/users/settings')) {
          return Response.json({ success: true, message: 'ok', data: userSettings });
        }
        if (request.url.includes('/pdfs?')) {
          return Response.json({
            success: true,
            message: 'ok',
            data: [
              {
                id: 'pdf-source-1',
                displayName: 'React notes.pdf',
                byteSize: 2048,
                pageCount: 8,
                status: 'ready',
                activeRevision: 1,
                failureCode: null,
                createdAt: '2026-11-06T00:00:00.000Z',
                updatedAt: '2026-11-06T00:00:00.000Z',
              },
            ],
          });
        }
        return Response.json({ success: false, message: 'Not found' }, { status: 404 });
      })
    );
    const user = userEvent.setup();
    renderSettingsPage();

    await screen.findByRole('textbox', { name: 'First Name' });
    expect(requestedUrls.some((url) => url.includes('/pdfs?'))).toBe(false);
    await user.click(screen.getByRole('tab', { name: 'AI & Sources' }));
    const sourceSwitch = await screen.findByRole('switch', {
      name: 'Include React notes.pdf as a question source',
    });
    expect(sourceSwitch).toHaveAttribute('aria-checked', 'true');
    await user.click(sourceSwitch);
    await user.click(screen.getByRole('button', { name: 'Save Preferences' }));

    await waitFor(() => expect(patchBodies).toHaveLength(1));
    expect(patchBodies[0]).toMatchObject({ preferences: { enabledPdfSourceIds: [] } });
    expect(requestedUrls.some((url) => url.includes('/pdfs?'))).toBe(true);
  });

  it('opens the Plan tab for a plan shortcut query parameter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        if (request.url.endsWith('/users/me')) {
          return Response.json({ success: true, message: 'ok', data: userProfile });
        }
        if (request.url.endsWith('/users/settings')) {
          return Response.json({ success: true, message: 'ok', data: userSettings });
        }
        if (request.url.endsWith('/theory/stats')) {
          return Response.json({
            success: true,
            message: 'ok',
            data: { dailySessions: { used: 1, limit: 3 }, questionsPerSession: 5 },
          });
        }
        if (request.url.endsWith('/coding/stats')) {
          return Response.json({
            success: true,
            message: 'ok',
            data: {
              solvedProblems: 2,
              currentStreak: 1,
              dailySolved: { used: 2, limit: 5 },
              dailyReviews: { used: 1, limit: 2 },
            },
          });
        }
        if (request.url.endsWith('/payments/subscriptions/current')) {
          return Response.json({ success: true, message: 'ok', data: null });
        }
        return Response.json({ success: false, message: 'Not found' }, { status: 404 });
      })
    );

    renderSettingsPage('/settings?tab=plan');

    expect(await screen.findByRole('tab', { name: 'Plan' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(await screen.findByText('Practice Sessions')).toBeVisible();
  });

  it('shows a clear toast when premium checkout is not configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        if (request.method === 'POST' && request.url.endsWith('/payments/subscriptions')) {
          return Response.json(
            {
              statusCode: 503,
              message: 'Razorpay subscriptions are not configured on this server',
              error: 'Service Unavailable',
            },
            { status: 503 }
          );
        }
        if (request.url.endsWith('/users/me')) {
          return Response.json({ success: true, message: 'ok', data: userProfile });
        }
        if (request.url.endsWith('/users/settings')) {
          return Response.json({ success: true, message: 'ok', data: userSettings });
        }
        if (request.url.endsWith('/theory/stats')) {
          return Response.json({
            success: true,
            message: 'ok',
            data: { dailySessions: { used: 0, limit: 3 }, questionsPerSession: 5 },
          });
        }
        if (request.url.endsWith('/coding/stats')) {
          return Response.json({
            success: true,
            message: 'ok',
            data: {
              solvedProblems: 0,
              currentStreak: 0,
              dailySolved: { used: 0, limit: 5 },
              dailyReviews: { used: 0, limit: 2 },
            },
          });
        }
        if (request.url.endsWith('/payments/subscriptions/current')) {
          return Response.json({ success: true, message: 'ok', data: null });
        }
        return Response.json({ success: false, message: 'Not found' }, { status: 404 });
      })
    );
    const user = userEvent.setup();
    renderSettingsPage();

    await screen.findByRole('textbox', { name: 'First Name' });
    await user.click(screen.getByRole('tab', { name: 'Plan' }));
    await user.click(await screen.findByRole('button', { name: 'Upgrade to Premium' }));

    const toastRegion = screen.getByRole('region', { name: 'Status updates' });
    expect(await within(toastRegion).findByRole('alert')).toHaveTextContent(
      'Premium checkout is unavailable because Razorpay billing is not configured on this server.'
    );
    expect(
      screen.queryByText('Razorpay subscriptions are not configured on this server')
    ).toBeNull();
  });

  it('shows the API validation message when saving settings fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (request: Request) => {
        if (request.url.endsWith('/users/me')) {
          return Response.json({ success: true, message: 'ok', data: userProfile });
        }
        if (request.method === 'PATCH') {
          return Response.json(
            { success: false, message: 'Timezone must be a valid IANA timezone' },
            { status: 400 }
          );
        }
        return Response.json({ success: true, message: 'ok', data: userSettings });
      })
    );
    const user = userEvent.setup();
    renderSettingsPage();

    await screen.findByRole('textbox', { name: 'First Name' });
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findAllByText('Timezone must be a valid IANA timezone')).toHaveLength(2);
    const toastRegion = screen.getByRole('region', { name: 'Status updates' });
    expect(await within(toastRegion).findByRole('alert')).toHaveTextContent(
      'Timezone must be a valid IANA timezone'
    );
  });
});
