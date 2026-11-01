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
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t load your settings');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
