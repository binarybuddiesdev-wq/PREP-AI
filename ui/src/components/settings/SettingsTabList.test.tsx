import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsTabList } from './SettingsTabList';

describe('SettingsTabList', () => {
  it('switches the selected tab and moves focus with arrow keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SettingsTabList activeTab="profile" onChange={onChange} />);
    const profileTab = screen.getByRole('tab', { name: 'Profile' });

    profileTab.focus();
    await user.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith('notifications');
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Notifications' })).toHaveFocus();
  });
});
