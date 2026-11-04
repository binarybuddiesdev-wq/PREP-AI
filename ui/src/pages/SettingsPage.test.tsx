import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
});
