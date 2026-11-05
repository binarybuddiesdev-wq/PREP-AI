import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ISettingsFormValues } from '@/core';
import { SettingsPracticePreferencesPanel } from './SettingsPracticePreferencesPanel';

const values: ISettingsFormValues = {
  targetRole: 'Backend Engineer',
  experienceLevel: 'Senior',
  targetCompanies: 'Google, Stripe',
  preferredTopics: ['React', 'TypeScript'],
  defaultDifficulty: 'Mid',
  dailyReminder: false,
  dailyReminderTime: '19:00',
  timezone: 'Asia/Kolkata',
};

describe('SettingsPracticePreferencesPanel', () => {
  it('updates focus topics and keeps at least one topic selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SettingsPracticePreferencesPanel values={values} isSaving={false} onChange={onChange} />
    );

    await user.click(screen.getByRole('button', { name: 'TypeScript' }));

    expect(onChange).toHaveBeenCalledWith({ ...values, preferredTopics: ['React'] });
    expect(screen.getByRole('button', { name: 'React' })).not.toBeDisabled();
  });
});
