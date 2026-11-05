import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { IOnboardingDraft } from '@/core';
import { OnboardingWizard } from './OnboardingWizard';
import type { IOnboardingWizardProps } from './OnboardingWizard.types';

const defaultDraft: IOnboardingDraft = {
  targetRole: '',
  experienceLevel: '',
  targetCompanies: '',
  preferredTopics: ['React'],
  defaultDifficulty: 'Mid',
};

const createWizardProps = (
  overrides: Partial<IOnboardingWizardProps> = {}
): IOnboardingWizardProps => ({
  brand: <span>PrepAI</span>,
  step: 1,
  values: defaultDraft,
  isSaving: false,
  errorMessage: null,
  errorDetails: null,
  onChange: vi.fn(),
  onContinue: vi.fn(),
  onBack: vi.fn(),
  onSkip: vi.fn(),
  onFinish: vi.fn(),
  ...overrides,
});

describe('OnboardingWizard', () => {
  it('shows the role and experience step with named progress', () => {
    const { container } = render(<OnboardingWizard {...createWizardProps()} />);

    expect(screen.getByRole('main', { name: 'Profile setup' })).toBeInTheDocument();
    expect(container.querySelector('.onboarding-screen')).toHaveClass('h-dvh', 'overflow-clip');
    expect(container.querySelector('.onboarding-card')).toHaveClass(
      'onboarding-card--viewport-fit',
      'overflow-hidden'
    );
    expect(container.querySelector('.onboarding-card')).toHaveClass('onboarding-card--compact');
    expect(container.querySelector('.onboarding-card')).not.toHaveClass('overflow-y-auto');
    expect(screen.getByRole('heading', { name: 'Tell us about your target role' })).toBeVisible();
    expect(screen.queryByText('Step 1 of 3')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Setup progress' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Target Role' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Experience Level' })).toBeInTheDocument();
    expect(
      screen.getByText('Save your target role and experience level to your profile.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/tailor questions for your target role/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('uses the shared theme tokens for onboarding surfaces, fields, and errors', () => {
    const { container } = render(
      <OnboardingWizard
        {...createWizardProps({
          step: 2,
          errorMessage: 'Could not save your progress.',
        })}
      />
    );

    expect(screen.getByRole('main', { name: 'Profile setup' })).toHaveClass(
      'bg-[var(--bg)]',
      'text-[var(--text)]'
    );
    expect(container.querySelector('.onboarding-card')).toHaveClass(
      'border-[var(--border)]',
      'bg-[var(--card)]'
    );
    expect(screen.getByRole('heading', { name: 'Let’s set up your profile' })).toHaveClass(
      'text-[var(--text-h)]'
    );
    expect(screen.getByRole('textbox', { name: /Target Companies/ })).toHaveClass(
      'border-[var(--border2)]',
      'bg-[var(--bg2)]',
      'text-[var(--text)]'
    );
    expect(screen.getByRole('alert')).toHaveClass(
      'border-[var(--red-bg)]',
      'bg-[var(--red-bg)]',
      'text-[var(--danger-strong)]'
    );
  });

  it('toggles a topic and reports the updated draft', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<OnboardingWizard {...createWizardProps({ step: 3, onChange })} />);

    expect(screen.getByRole('button', { name: 'React' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'TypeScript' }));

    expect(onChange).toHaveBeenCalledWith({
      ...defaultDraft,
      preferredTopics: ['React', 'TypeScript'],
    });
    expect(screen.getByRole('combobox', { name: 'Default Difficulty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Practicing' })).toBeInTheDocument();
  });

  it('shows back, continue, skip, and a visible save error on the company step', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onContinue = vi.fn();
    const onSkip = vi.fn();

    render(
      <OnboardingWizard
        {...createWizardProps({
          step: 2,
          onBack,
          onContinue,
          onSkip,
          errorMessage: 'Could not save your progress.',
        })}
      />
    );

    expect(screen.getByRole('heading', { name: 'Where are you applying?' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save your progress.');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('offers supported difficulty values and disables all editable controls while saving', () => {
    const { rerender } = render(
      <OnboardingWizard {...createWizardProps({ step: 3, isSaving: true })} />
    );

    const difficulty = screen.getByRole('combobox', { name: 'Default Difficulty' });
    expect(difficulty).toBeDisabled();
    expect(screen.getByRole('button', { name: 'React' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeDisabled();

    rerender(<OnboardingWizard {...createWizardProps({ step: 1, isSaving: true })} />);
    expect(screen.getByRole('combobox', { name: 'Target Role' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Experience Level' })).toBeDisabled();

    rerender(<OnboardingWizard {...createWizardProps({ step: 2, isSaving: true })} />);
    expect(screen.getByRole('textbox', { name: /Target Companies/ })).toBeDisabled();
  });

  it('opens the consistent styled dropdown menu for onboarding fields', async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard {...createWizardProps()} />);

    const roleDropdown = screen.getByRole('combobox', { name: 'Target Role' });
    expect(roleDropdown).toHaveClass('settings-select-trigger');
    await user.click(roleDropdown);
    const option = await screen.findByRole('option', { name: 'Frontend Engineer' });
    expect(option.closest('.settings-select-popup')).toBeInTheDocument();
    expect(option.closest('.settings-select-popup')).toHaveClass('settings-select-popup--dense');
    expect(option).toHaveClass('settings-select-item--dense');
    expect(option).toBeVisible();
  });
});
