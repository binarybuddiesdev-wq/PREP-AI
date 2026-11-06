import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ICodingStats } from '@/core';
import { CodingStatsBar } from './CodingStatsBar';

const stats: ICodingStats = {
  solved: 7,
  dailySolved: { used: 2, limit: 5 },
  dailyReviews: { used: 1, limit: 3 },
  streakDays: 4,
};

describe('CodingStatsBar', () => {
  it('shows server-provided coding totals and quota limits', () => {
    render(
      <CodingStatsBar
        stats={stats}
        isLoading={false}
        isRetrying={false}
        errorMessage={null}
        onRetry={vi.fn()}
      />
    );

    const metrics = screen.getByRole('group', { name: 'Coding statistics' });
    expect(metrics).toHaveClass('border-[var(--border)]', 'bg-[var(--card)]', 'gap-6');
    expect(metrics.firstElementChild).toHaveClass('text-center');
    expect(within(metrics).getByText('7')).toHaveClass('text-[var(--text)]');
    expect(within(metrics).getByText('Solved')).toBeVisible();
    expect(within(metrics).getByText('7')).toBeVisible();
    expect(within(metrics).getByText('Today')).toBeVisible();
    expect(within(metrics).getByText('2 / 5')).toBeVisible();
    expect(within(metrics).getByText('AI Reviews')).toBeVisible();
    expect(within(metrics).getByText('1 / 3')).toBeVisible();
    expect(within(metrics).getByText('Day Streak')).toBeVisible();
    expect(within(metrics).getByText('4')).toBeVisible();
  });

  it('shows a loading status without displaying placeholder counts', () => {
    render(
      <CodingStatsBar
        stats={null}
        isLoading
        isRetrying={false}
        errorMessage={null}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading coding stats');
    expect(screen.queryByText('Solved')).toBeNull();
  });

  it('shows the error and lets the user retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <CodingStatsBar
        stats={null}
        isLoading={false}
        isRetrying={false}
        errorMessage="Coding stats could not be loaded."
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert')).toHaveClass('border-[var(--red-bg)]', 'bg-[var(--red-bg)]');
    expect(screen.getByRole('alert')).toHaveTextContent('Coding stats could not be loaded.');
    await user.click(screen.getByRole('button', { name: 'Retry coding stats' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
