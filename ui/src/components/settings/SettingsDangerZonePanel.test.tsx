import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsDangerZonePanel } from './SettingsDangerZonePanel';

describe('SettingsDangerZonePanel', () => {
  it('explains when destructive actions are unavailable instead of pretending they succeeded', () => {
    render(<SettingsDangerZonePanel />);

    expect(screen.getByText(/cannot be performed from this screen yet/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reset Progress' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Account' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export Data' })).toBeDisabled();
  });
});
