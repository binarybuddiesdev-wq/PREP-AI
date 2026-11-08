import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ISettingsFormValues } from '@/core';
import { SettingsProfilePanel } from './SettingsProfilePanel';

const values: ISettingsFormValues = {
  targetRole: 'Backend Engineer',
  experienceLevel: 'Senior',
  targetCompanies: 'Google, Stripe',
  preferredTopics: ['React'],
  defaultDifficulty: 'Mid',
  sessionLength: 10,
  timerPerQuestion: 5,
  showHintsOnSkip: true,
  autoAdvance: false,
  dailyReminder: false,
  dailyReminderTime: '19:00',
  timezone: 'Asia/Kolkata',
  weeklyProgressReport: true,
  newQuestionsAlert: false,
  streakMilestoneAlerts: true,
  emailDigest: false,
};

describe('SettingsProfilePanel', () => {
  it('shows editable Clerk names, a read-only email, and the saved company list', () => {
    render(
      <SettingsProfilePanel
        values={values}
        firstName="Asha"
        lastName="Rao"
        userEmail="asha@example.com"
        isSaving={false}
        onIdentityChange={vi.fn()}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('textbox', { name: 'First Name' })).toHaveValue('Asha');
    expect(screen.getByRole('textbox', { name: 'Last Name' })).toHaveValue('Rao');
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue('asha@example.com');
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: 'Target companies' })).toHaveValue('Google, Stripe');
    expect(screen.getByRole('textbox', { name: 'Target companies' })).toHaveClass(
      'border-[var(--border2)]',
      'bg-[var(--bg2)]',
      'text-[var(--text)]',
      'placeholder:text-[var(--faint)]'
    );
  });

  it('reports first and last name edits separately from backend settings', async () => {
    const user = userEvent.setup();
    const onIdentityChange = vi.fn();
    const ProfileHarness = () => {
      const [identity, setIdentity] = useState({ firstName: 'Asha', lastName: 'Rao' });
      return (
        <SettingsProfilePanel
          values={values}
          {...identity}
          userEmail="asha@example.com"
          isSaving={false}
          onIdentityChange={(nextIdentity) => {
            onIdentityChange(nextIdentity);
            setIdentity(nextIdentity);
          }}
          onChange={vi.fn()}
        />
      );
    };
    render(<ProfileHarness />);

    await user.clear(screen.getByRole('textbox', { name: 'First Name' }));
    await user.type(screen.getByRole('textbox', { name: 'First Name' }), 'Mira');
    await user.clear(screen.getByRole('textbox', { name: 'Last Name' }));
    await user.type(screen.getByRole('textbox', { name: 'Last Name' }), 'Shah');

    expect(onIdentityChange).toHaveBeenLastCalledWith({ firstName: 'Mira', lastName: 'Shah' });
  });

  it('reports target company edits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const ProfileHarness = () => {
      const [currentValues, setCurrentValues] = useState(values);
      return (
        <SettingsProfilePanel
          values={currentValues}
          firstName="Asha"
          lastName="Rao"
          userEmail="asha@example.com"
          isSaving={false}
          onIdentityChange={vi.fn()}
          onChange={(nextValues) => {
            onChange(nextValues);
            setCurrentValues(nextValues);
          }}
        />
      );
    };
    render(<ProfileHarness />);

    await user.clear(screen.getByRole('textbox', { name: 'Target companies' }));
    await user.type(screen.getByRole('textbox', { name: 'Target companies' }), 'Acme');

    expect(onChange).toHaveBeenLastCalledWith({ ...values, targetCompanies: 'Acme' });
  });
});
