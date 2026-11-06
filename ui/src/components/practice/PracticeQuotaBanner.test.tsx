import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PracticeQuotaBanner } from './PracticeQuotaBanner';
import type { IPracticeQuotaBannerProps } from './PracticeQuotaBanner.types';

const createProps = (overrides: Partial<IPracticeQuotaBannerProps> = {}) => ({
  dailySessions: null,
  isLoading: false,
  isRetrying: false,
  errorMessage: null,
  onRetry: vi.fn(),
  ...overrides,
});

describe('PracticeQuotaBanner', () => {
  it('announces when practice usage is loading', () => {
    render(<PracticeQuotaBanner {...createProps({ isLoading: true })} />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading today's practice usage/i);
  });

  it('shows the remaining sessions from server usage', () => {
    render(<PracticeQuotaBanner {...createProps({ dailySessions: { used: 2, limit: 3 } })} />);

    expect(screen.getByRole('status')).toHaveTextContent('1 of 3 sessions left today');
  });

  it('explains when the server-reported daily limit has been reached', () => {
    render(<PracticeQuotaBanner {...createProps({ dailySessions: { used: 3, limit: 3 } })} />);

    expect(screen.getByRole('status')).toHaveTextContent(/daily practice limit reached/i);
    expect(screen.getByText(/try again tomorrow/i)).toBeVisible();
  });

  it('shows a retry action when practice usage could not be loaded', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <PracticeQuotaBanner
        {...createProps({ errorMessage: 'Usage service is unavailable.', onRetry })}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Usage service is unavailable.');
    await user.click(screen.getByRole('button', { name: 'Retry usage' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('prevents duplicate usage retries while a request is in progress', () => {
    render(
      <PracticeQuotaBanner
        {...createProps({
          errorMessage: 'Usage service is unavailable.',
          isRetrying: true,
        })}
      />
    );

    expect(screen.getByRole('button', { name: 'Retrying usage' })).toBeDisabled();
  });
});
