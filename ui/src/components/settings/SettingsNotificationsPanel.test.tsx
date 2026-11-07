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
};

describe('SettingsNotificationsPanel', () => {
  it('disables reminder controls while the settings request is saving', () => {
    render(<SettingsNotificationsPanel values={values} isSaving onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Daily practice reminder' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Daily practice reminder' })).toHaveClass(
      'border-[var(--border2)]',
      'bg-[var(--bg2)]',
      'accent-[var(--accent)]'
    );
    expect(screen.getByText('Get one email reminder at your chosen local time.')).toHaveClass(
      'text-[var(--dim)]'
    );
    expect(screen.getByText('Reminder time')).toHaveClass('text-[var(--dim)]');
    expect(screen.getByLabelText('Reminder time')).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Time zone' })).toBeDisabled();
  });

  it('reports reminder opt-in changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SettingsNotificationsPanel values={values} isSaving={false} onChange={onChange} />);

    await user.click(screen.getByRole('checkbox', { name: 'Daily practice reminder' }));

    expect(onChange).toHaveBeenCalledWith({ ...values, dailyReminder: true });
  });
});
