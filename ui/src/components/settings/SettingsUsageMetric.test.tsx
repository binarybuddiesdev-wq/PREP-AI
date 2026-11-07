import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SettingsUsageMetric } from './SettingsUsageMetric';

describe('SettingsUsageMetric', () => {
  it('renders its label and formatted usage value as a definition pair', () => {
    render(<SettingsUsageMetric label="Daily sessions" value="2 of 3" />);

    expect(screen.getByText('Daily sessions').tagName).toBe('DT');
    expect(screen.getByText('2 of 3').tagName).toBe('DD');
  });

  it('preserves zero values instead of treating them as absent', () => {
    render(<SettingsUsageMetric label="Remaining" value="0" />);

    expect(screen.getByText('0')).toBeVisible();
  });
});
