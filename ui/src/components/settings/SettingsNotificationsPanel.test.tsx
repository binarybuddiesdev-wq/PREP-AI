import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ISettingsFormValues } from '@/core';
import { SettingsNotificationsPanel } from './SettingsNotificationsPanel';

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

describe('SettingsNotificationsPanel', () => {
  it('disables reminder controls while the settings request is saving', () => {
    render(<SettingsNotificationsPanel values={values} isSaving onChange={vi.fn()} />);

    expect(screen.getByRole('switch', { name: 'Daily Practice Reminder' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Weekly Progress Report' })).toBeDisabled();
    expect(screen.getByLabelText('Reminder time')).toHaveValue('19:00');
    expect(screen.getByLabelText('Reminder time')).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Time zone' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Time zone' })).toHaveValue('Asia/Kolkata');
  });

  it('renders and updates all notification preference switches', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SettingsNotificationsPanel values={values} isSaving={false} onChange={onChange} />);

    const weeklyReport = screen.getByRole('switch', { name: 'Weekly Progress Report' });
    expect(weeklyReport).toHaveAttribute('aria-checked', 'true');
    await user.click(weeklyReport);
    expect(onChange).toHaveBeenLastCalledWith({ ...values, weeklyProgressReport: false });
    expect(screen.getByRole('switch', { name: 'New Questions Alert' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(screen.getByRole('switch', { name: 'Streak Milestone Alerts' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('switch', { name: 'Email Digest' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('reports reminder opt-in changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SettingsNotificationsPanel values={values} isSaving={false} onChange={onChange} />);

    await user.click(screen.getByRole('switch', { name: 'Daily Practice Reminder' }));

    expect(onChange).toHaveBeenCalledWith({ ...values, dailyReminder: true });
  });
});
