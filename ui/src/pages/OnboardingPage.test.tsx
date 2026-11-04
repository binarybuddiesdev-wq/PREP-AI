import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IUser, IUserSettings } from '@/core';
import { OnboardingPage } from './OnboardingPage';

const serviceMocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  setupComplete: vi.fn(),
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: vi.fn(), signOut: vi.fn() }),
  useUser: () => ({ user: null }),
}));

vi.mock('@/service/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/service/api')>()),
  getMe: serviceMocks.getMe,
  getSettings: serviceMocks.getSettings,
  updateSettings: serviceMocks.updateSettings,
  setupComplete: serviceMocks.setupComplete,
}));

const newUser: IUser = {
  id: 'user-1',
  clerkUserId: 'clerk-user-1',
  email: 'asha@example.com',
  name: 'Asha',
  role: 'USER',
  isNewUser: true,
};

const createSettings = (overrides: Partial<IUserSettings> = {}): IUserSettings => ({
  id: 'settings-1',
  userId: 'user-1',
  profile: null,
  preferences: null,
  notifications: null,
  ...overrides,
});

const CurrentPath = () => {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
};

const renderOnboarding = (initialPath = '/onboarding') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(
    <Wrapper>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<h1>Dashboard destination</h1>} />
        </Routes>
        <CurrentPath />
      </MemoryRouter>
    </Wrapper>
  );
};

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.getMe.mockResolvedValue({ success: true, message: 'ok', data: newUser });
    serviceMocks.getSettings.mockResolvedValue({ success: true, message: 'ok', data: null });
    serviceMocks.updateSettings.mockResolvedValue({ success: true, message: 'ok', data: null });
    serviceMocks.setupComplete.mockResolvedValue({
      success: true,
      message: 'ok',
      data: { ...newUser, isNewUser: false },
    });
  });

  it('restores saved step and values so a user can resume setup', async () => {
    serviceMocks.getSettings.mockResolvedValue({
      success: true,
      message: 'ok',
      data: createSettings({
        profile: {
          targetRole: 'Backend Engineer',
          experienceLevel: 'Mid',
          targetCompanies: 'Stripe, Shopify',
        },
        preferences: {
          preferredTopics: ['Node.js'],
          defaultDifficulty: 'Senior',
          onboardingStep: 2,
        },
      }),
    });

    renderOnboarding();

    expect(await screen.findByRole('heading', { name: 'Where are you applying?' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: /Target Companies/ })).toHaveValue(
      'Stripe, Shopify'
    );
    expect(screen.getByRole('listitem', { name: /Step 2: Target companies/ })).toHaveAttribute(
      'aria-current',
      'step'
    );
  });

  it('requires role and experience before saving the first step', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await screen.findByRole('heading', { name: 'Tell us about your target role' });
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/select both/i);
    expect(serviceMocks.updateSettings).not.toHaveBeenCalled();
  });

  it('saves all three steps, completes setup, and opens the dashboard', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Target Role' }),
      'Backend Engineer'
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Experience Level' }), 'Senior');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Where are you applying?' })).toBeVisible();
    expect(serviceMocks.updateSettings).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        profile: expect.objectContaining({
          targetRole: 'Backend Engineer',
          experienceLevel: 'Senior',
        }),
        preferences: expect.objectContaining({ onboardingStep: 2 }),
      })
    );

    await user.type(screen.getByRole('textbox', { name: /Target Companies/ }), 'Stripe, Shopify');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Pick your focus areas' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'TypeScript' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Default Difficulty' }),
      'Junior'
    );
    await user.click(screen.getByRole('button', { name: 'Start Practicing' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard destination' })).toBeVisible();
    expect(serviceMocks.updateSettings).toHaveBeenCalledTimes(3);
    expect(serviceMocks.setupComplete).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/dashboard');
  });

  it('preserves company text when moving back and forward before saving that step', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Target Role' }),
      'Backend Engineer'
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Experience Level' }), 'Mid');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const companyInput = await screen.findByRole('textbox', { name: /Target Companies/ });
    await user.type(companyInput, 'Stripe');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('textbox', { name: /Target Companies/ })).toHaveValue('Stripe');
  });

  it('lets a user skip by completing setup without saving incomplete values', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await screen.findByRole('heading', { name: 'Tell us about your target role' });
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard destination' })).toBeVisible();
    expect(serviceMocks.setupComplete).toHaveBeenCalledOnce();
    expect(serviceMocks.updateSettings).not.toHaveBeenCalled();
  });

  it('keeps setup available when skipping cannot be completed', async () => {
    const user = userEvent.setup();
    serviceMocks.setupComplete.mockRejectedValue(new Error('API unavailable'));
    renderOnboarding();

    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/complete setup/i);
    expect(screen.getByRole('heading', { name: 'Tell us about your target role' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeEnabled();
    expect(serviceMocks.updateSettings).not.toHaveBeenCalled();
  });

  it('keeps the current step visible when progress cannot be saved', async () => {
    const user = userEvent.setup();
    serviceMocks.updateSettings.mockRejectedValue(new Error('API unavailable'));
    renderOnboarding();

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Target Role' }),
      'Backend Engineer'
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Experience Level' }), 'Senior');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/save your progress/i);
    expect(screen.getByRole('heading', { name: 'Tell us about your target role' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('redirects a user whose setup is already complete', async () => {
    serviceMocks.getMe.mockResolvedValue({
      success: true,
      message: 'ok',
      data: { ...newUser, isNewUser: false },
    });

    renderOnboarding();

    expect(await screen.findByRole('heading', { name: 'Dashboard destination' })).toBeVisible();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/dashboard');
  });

  it('offers retry when saved onboarding settings fail to load', async () => {
    serviceMocks.getSettings
      .mockRejectedValueOnce(new Error('API unavailable'))
      .mockResolvedValue({ success: true, message: 'ok', data: null });
    const user = userEvent.setup();

    renderOnboarding();

    expect(await screen.findByRole('alert')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: 'Tell us about your target role' })
    ).toBeVisible();
  });

  it('offers retry when the profile cannot be loaded', async () => {
    serviceMocks.getMe
      .mockRejectedValueOnce(new Error('API unavailable'))
      .mockResolvedValue({ success: true, message: 'ok', data: newUser });
    const user = userEvent.setup();

    renderOnboarding();

    expect(await screen.findByRole('alert')).toHaveTextContent(/load your profile/i);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { name: 'Tell us about your target role' })
    ).toBeVisible();
  });
});
