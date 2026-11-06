import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ISettingsFormValues } from '@/core';
import { SettingsFormCard } from './SettingsFormCard';
import type { ISettingsFormCardProps } from './SettingsFormCard.types';

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

const renderCard = (overrides: Partial<ISettingsFormCardProps> = {}) => {
  const props: ISettingsFormCardProps = {
    values,
    userName: 'Asha Rao',
    userEmail: 'asha@example.com',
    isSaving: false,
    status: null,
    onChange: vi.fn(),
    onSave: vi.fn(),
    onOpenDocuments: vi.fn(),
    ...overrides,
  };
  render(<SettingsFormCard {...props} />);
  return props;
};

describe('SettingsFormCard', () => {
  it('shows a compact profile tab with identity and editable profile preferences', () => {
    renderCard();

    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Target Role' })).toHaveTextContent('Backend');
    expect(screen.getByRole('textbox', { name: 'Target companies' })).toHaveValue('Google, Stripe');
    expect(screen.queryByText(/UserSettings Model|Raw UserSettings JSON/)).not.toBeInTheDocument();
  });

  it('keeps section tabs outside the reference content card and labels the active panel', () => {
    renderCard();

    const tabList = screen.getByRole('tablist', { name: 'Settings sections' });
    const panel = screen.getByRole('tabpanel');

    expect(tabList.parentElement).not.toBe(panel.parentElement);
    expect(panel.parentElement).toHaveClass(
      'rounded-xl',
      'border-[var(--border)]',
      'bg-[var(--card)]'
    );
    expect(within(panel).getByRole('heading', { name: 'Profile' })).toBeVisible();
  });

  it('connects every tab to its corresponding panel', () => {
    renderCard();

    for (const tab of screen.getAllByRole('tab')) {
      const panelId = tab.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      expect(document.getElementById(panelId!)).toBeInTheDocument();
    }
  });

  it('uses theme-aware tabs, content panel, and save action colors', () => {
    renderCard();

    const tabHeader = screen.getByRole('tablist').closest('header');
    const saveFooter = screen.getByRole('button', { name: 'Save Changes' }).closest('footer');
    const formCard = screen.getByRole('tabpanel').parentElement;
    const activeTab = screen.getByRole('tab', { name: 'Profile' });
    const inactiveTab = screen.getByRole('tab', { name: 'Notifications' });

    expect(tabHeader).toHaveClass('border-[var(--border)]');
    expect(saveFooter).toHaveClass('mt-5');
    expect(formCard).toHaveClass('border-[var(--border)]', 'bg-[var(--card)]');
    expect(activeTab).toHaveClass('border-[var(--accent)]', 'text-[var(--accent-strong)]');
    expect(inactiveTab).toHaveClass('text-[var(--dim)]', 'hover:text-[var(--text)]');
    expect(tabHeader).not.toHaveClass('border-white/[0.08]');
    expect(formCard).not.toHaveClass('border-white/[0.08]');
  });

  it('uses the reference save labels for each editable settings tab', async () => {
    const user = userEvent.setup();
    renderCard();

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Notifications' }));
    expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeVisible();
    await user.click(screen.getByRole('tab', { name: 'Practice Preferences' }));
    expect(screen.getByRole('button', { name: 'Save Preferences' })).toBeVisible();
  });

  it('uses a theme-aware success color for saved feedback', () => {
    renderCard({ status: { kind: 'success', message: 'Settings saved' } });
    expect(screen.getByRole('status')).toHaveClass('text-[var(--success-strong)]');
  });

  it('uses a theme-aware error color for failed feedback', () => {
    renderCard({ status: { kind: 'error', message: 'Save failed' } });
    expect(screen.getByRole('alert')).toHaveClass('text-[var(--danger-strong)]');
  });

  it('switches panels accessibly and edits supported practice preferences', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCard();

    await user.click(screen.getByRole('tab', { name: 'Practice Preferences' }));
    const panel = screen.getByRole('tabpanel');

    expect(screen.getByRole('tab', { name: 'Practice Preferences' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(within(panel).getByRole('combobox', { name: 'Default difficulty' })).toHaveTextContent(
      'Mid'
    );
    expect(within(panel).getByRole('button', { name: 'React' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await user.click(within(panel).getByRole('button', { name: 'TypeScript' }));

    expect(onChange).toHaveBeenCalledWith({ ...values, preferredTopics: ['React'] });
  });

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    renderCard();
    const profileTab = screen.getByRole('tab', { name: 'Profile' });

    profileTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Notifications' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: 'Notifications' })).toHaveFocus();
  });

  it('shows the reminder schedule beside the daily reminder opt-in', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCard();

    await user.click(screen.getByRole('tab', { name: 'Notifications' }));
    expect(screen.getByLabelText('Reminder time')).toHaveValue('19:00');
    expect(screen.getByRole('textbox', { name: 'Time zone' })).toHaveValue('Asia/Kolkata');

    await user.click(screen.getByRole('checkbox', { name: 'Daily practice reminder' }));

    expect(onChange).toHaveBeenCalledWith({ ...values, dailyReminder: true });
    expect(screen.queryByText(/weekly report/i)).not.toBeInTheDocument();
  });

  it('disables the reminder opt-in while settings are saving', async () => {
    const user = userEvent.setup();
    const { onChange } = renderCard({ isSaving: true });

    await user.click(screen.getByRole('tab', { name: 'Notifications' }));

    expect(screen.getByRole('checkbox', { name: 'Daily practice reminder' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('opens the existing documents screen from its tab', async () => {
    const user = userEvent.setup();
    const { onOpenDocuments } = renderCard();

    await user.click(screen.getByRole('tab', { name: 'Documents' }));
    await user.click(screen.getByRole('button', { name: 'Manage documents' }));

    expect(onOpenDocuments).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Save Settings' })).not.toBeInTheDocument();
  });

  it('keeps the save action and status visible on editable panels', () => {
    renderCard({ status: { kind: 'error', message: 'Invalid time zone' } });

    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid time zone');
  });
});
