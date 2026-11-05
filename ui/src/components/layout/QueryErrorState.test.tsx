import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { QueryErrorState } from './QueryErrorState';

describe('QueryErrorState', () => {
  it('explains the failure and lets the user retry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(
      <QueryErrorState
        title="Couldn’t load your settings"
        description="Check your connection and try again."
        details="HTTP 503: Service temporarily unavailable."
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert')).toHaveClass('border-[var(--red-bg)]', 'bg-[var(--red-bg)]');
    expect(screen.getByRole('heading', { name: 'Couldn’t load your settings' })).toHaveClass(
      'text-[var(--text-h)]'
    );
    expect(screen.getByText('Check your connection and try again.')).toHaveClass(
      'text-[var(--dim)]'
    );
    expect(screen.getByText('HTTP 503: Service temporarily unavailable.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
