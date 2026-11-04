import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingMetrics } from './LandingMetrics';

describe('LandingMetrics', () => {
  it('shows the configured values and labels when scroll animation is unavailable', () => {
    render(
      <LandingMetrics
        metrics={[
          { label: 'Questions', suffix: '+', target: 500 },
          { label: 'Sessions', suffix: 'k+', target: 12 },
          { decimal: true, label: 'User Rating', suffix: '', target: 4.9 },
        ]}
      />
    );

    expect(screen.getByText('500+')).toBeInTheDocument();
    expect(screen.getByText('12k+')).toBeInTheDocument();
    expect(screen.getByText('4.9')).toBeInTheDocument();
    expect(screen.getByText('User Rating')).toBeInTheDocument();
  });
});
