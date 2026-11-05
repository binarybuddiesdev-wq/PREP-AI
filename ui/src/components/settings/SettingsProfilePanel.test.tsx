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
  dailyReminder: false,
  dailyReminderTime: '19:00',
  timezone: 'Asia/Kolkata',
};

describe('SettingsProfilePanel', () => {
  it('shows Clerk identity and the saved company list', () => {
    render(
      <SettingsProfilePanel
        values={values}
        userName="Asha Rao"
        userEmail="asha@example.com"
        isSaving={false}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Target companies' })).toHaveValue('Google, Stripe');
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
