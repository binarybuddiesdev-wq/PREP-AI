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

describe('SettingsPracticePreferencesPanel', () => {
  it('uses theme-aware tokens for unselected topic controls', () => {
    render(
      <SettingsPracticePreferencesPanel values={values} isSaving={false} onChange={vi.fn()} />
    );

    const unselectedTopic = screen.getByRole('button', { name: 'Node.js' });

    expect(screen.getByText('Preferred Topics')).toHaveClass('text-[var(--dim)]');
    expect(unselectedTopic).toHaveClass(
      'border-[var(--border)]',
      'bg-[var(--surface)]',
      'text-[var(--dim)]'
    );
    expect(unselectedTopic).not.toHaveClass('border-white/10', 'bg-white/[0.03]');
  });

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

  it('reports default difficulty changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SettingsPracticePreferencesPanel values={values} isSaving={false} onChange={onChange} />
    );

    await user.click(screen.getByRole('combobox', { name: 'Default Difficulty' }));
    await user.click(screen.getByRole('option', { name: 'Senior' }));

    expect(onChange).toHaveBeenCalledWith({ ...values, defaultDifficulty: 'Senior' });
  });

  it('saves session length and question timer preferences as numbers', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SettingsPracticePreferencesPanel values={values} isSaving={false} onChange={onChange} />
    );

    await user.click(screen.getByRole('combobox', { name: 'Session Length' }));
    await user.click(screen.getByRole('option', { name: '15 questions' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...values, sessionLength: 15 });

    await user.click(screen.getByRole('combobox', { name: 'Timer per Question' }));
    await user.click(screen.getByRole('option', { name: 'No timer' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...values, timerPerQuestion: 0 });
  });

  it('updates skip hint and automatic advance switches', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SettingsPracticePreferencesPanel values={values} isSaving={false} onChange={onChange} />
    );

    await user.click(screen.getByRole('switch', { name: 'Show hints after skip' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...values, showHintsOnSkip: false });
    await user.click(screen.getByRole('switch', { name: 'Auto-advance to next question' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...values, autoAdvance: true });
  });
});
