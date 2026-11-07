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
  it('shows Clerk identity in read-only profile fields and the saved company list', () => {
    render(
      <SettingsProfilePanel
        values={values}
        userName="Asha Rao"
        userEmail="asha@example.com"
        isSaving={false}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('textbox', { name: 'First Name' })).toHaveValue('Asha');
    expect(screen.getByRole('textbox', { name: 'First Name' })).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: 'Last Name' })).toHaveValue('Rao');
    expect(screen.getByRole('textbox', { name: 'Last Name' })).toHaveAttribute('readonly');
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

  it('reports target company edits', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const ProfileHarness = () => {
      const [currentValues, setCurrentValues] = useState(values);
      return (
        <SettingsProfilePanel
          values={currentValues}
          userName="Asha Rao"
          userEmail="asha@example.com"
          isSaving={false}
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
