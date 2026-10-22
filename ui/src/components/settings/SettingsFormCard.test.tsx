import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ISettingsFormValues } from '@/core';
import { SettingsFormCard } from './SettingsFormCard';
import type { ISettingsFormCardProps } from './SettingsFormCard.types';

const values: ISettingsFormValues = {
  targetRole: 'Backend',
  experienceLevel: '',
  dailyReminder: true,
  weeklyReport: false,
};

const renderCard = (overrides: Partial<ISettingsFormCardProps> = {}) => {
  const props: ISettingsFormCardProps = {
    values,
    isSaving: false,
    status: null,
    onChange: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
  render(<SettingsFormCard {...props} />);
  return props;
};

describe('SettingsFormCard', () => {
  it('shows the current values', () => {
    renderCard();

    expect(screen.getByLabelText('Target Role')).toHaveValue('Backend');
    expect(screen.getByLabelText('Daily Practice Reminder')).toBeChecked();
    expect(screen.getByLabelText('Weekly Progress Report')).not.toBeChecked();
  });

  it('emits the full values object when a select changes', async () => {
    const { onChange } = renderCard();

    await userEvent.selectOptions(screen.getByLabelText('Experience Level'), 'Senior');

    expect(onChange).toHaveBeenCalledWith({ ...values, experienceLevel: 'Senior' });
  });

  it('emits the full values object when a checkbox toggles', async () => {
    const { onChange } = renderCard();

    await userEvent.click(screen.getByLabelText('Weekly Progress Report'));

    expect(onChange).toHaveBeenCalledWith({ ...values, weeklyReport: true });
  });

  it('calls onSave when the button is clicked', async () => {
    const { onSave } = renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('disables the button while saving', () => {
    renderCard({ isSaving: true });

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });

  it('renders the save status', () => {
    renderCard({ status: { kind: 'error', message: 'Failed to save settings' } });

    expect(screen.getByText('Failed to save settings')).toBeInTheDocument();
  });
});
