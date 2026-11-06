import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ITheoryScoreTrendPoint } from '@/core';
import { ScoreTrendChart } from './ScoreTrendChart';

const points: ITheoryScoreTrendPoint[] = [
  { date: '2026-11-04', avgScore: 8 },
  { date: '2026-11-05', avgScore: 4 },
];

describe('ScoreTrendChart', () => {
  it('plots the supplied score points with labeled dates and score gridlines', () => {
    const { container } = render(<ScoreTrendChart points={points} />);
    const firstDateLabel = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date('2026-11-04T12:00:00'));
    const secondDateLabel = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date('2026-11-05T12:00:00'));
    const chart = screen.getByRole('img', {
      name: `Score trend for the last 2 sessions: ${firstDateLabel}: 8.0/10, ${secondDateLabel}: 4.0/10`,
    });

    expect(chart).toHaveAttribute('viewBox', '0 0 360 180');
    expect(within(chart).getByText('10')).toBeInTheDocument();
    expect(within(chart).getByText('5')).toBeInTheDocument();
    expect(within(chart).getByText('0')).toBeInTheDocument();
    expect(within(chart).getByText(firstDateLabel)).toBeInTheDocument();
    expect(within(chart).getByText(secondDateLabel)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-score-trend-point]')).toHaveLength(2);
    expect(container.querySelector('[data-score-trend-line]')).toHaveAttribute(
      'd',
      expect.stringContaining('M')
    );
  });
});
