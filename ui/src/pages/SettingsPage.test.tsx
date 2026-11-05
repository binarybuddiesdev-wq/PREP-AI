import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingsPage } from './SettingsPage';

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
      emailAddresses: [{ emailAddress: 'asha@example.com' }],
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    },
  }),
}));

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

  const renderSettingsPage = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/settings']}>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('shows a retryable message when profile and settings requests fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Unauthorized', { status: 401 }))
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const errorAlert = await screen.findByRole('alert');
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

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText(/weekly report|AI model|danger zone/i)).not.toBeInTheDocument();
    await user.clear(screen.getByRole('textbox', { name: 'Target companies' }));
    await user.type(screen.getByRole('textbox', { name: 'Target companies' }), 'Stripe, Acme');
    await user.click(screen.getByRole('tab', { name: 'Notifications' }));
    await user.click(screen.getByRole('checkbox', { name: 'Daily practice reminder' }));
    await user.clear(screen.getByRole('textbox', { name: 'Time zone' }));
    await user.type(screen.getByRole('textbox', { name: 'Time zone' }), 'Europe/London');
    await user.click(screen.getByRole('tab', { name: 'Profile' }));
    expect(screen.getByRole('textbox', { name: 'Target companies' })).toHaveValue('Stripe, Acme');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(patchBodies).toHaveLength(1));
    expect(patchBodies[0]).toMatchObject({
      profile: { targetRole: 'Backend Engineer', targetCompanies: 'Stripe, Acme' },
      preferences: { onboardingStep: 3, preferredTopics: ['React', 'TypeScript'] },
      notifications: { dailyReminder: true, email: true, timezone: 'Europe/London' },
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Settings saved successfully');
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

    await screen.findByText('Asha Rao');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Timezone must be a valid IANA timezone'
    );
  });
});
