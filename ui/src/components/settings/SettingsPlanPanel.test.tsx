import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ICodingStats, IPaymentSubscription, ITheoryStats } from '@/core';
import { SettingsPlanPanel } from './SettingsPlanPanel';
import type { ISettingsPlanPanelProps } from './SettingsPlanPanel.types';

const theoryStats: ITheoryStats = {
  dailySessions: { used: 2, limit: 3 },
  questionsPerSession: 10,
};
const codingStats: ICodingStats = {
  solved: 8,
  dailySolved: { used: 2, limit: 5 },
  dailyReviews: { used: 1, limit: 3 },
  streakDays: 4,
};
const activeSubscription: IPaymentSubscription = {
  id: 'subscription-1',
  plan: 'yearly',
  status: 'active',
  cancelAtPeriodEnd: false,
  checkoutUrl: null,
  currentPeriodStart: '2026-01-01T00:00:00.000Z',
  currentPeriodEnd: '2027-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const makeProps = (overrides: Partial<ISettingsPlanPanelProps> = {}): ISettingsPlanPanelProps => ({
  role: 'USER',
  usage: {
    theoryStats,
    codingStats,
    isLoading: false,
    errorMessage: null,
    onRetry: vi.fn(),
  },
  billing: {
    subscription: null,
    isLoading: false,
    errorMessage: null,
    createErrorMessage: null,
    createdSubscription: null,
    isCreating: false,
    cancelErrorMessage: null,
    isCancelling: false,
    onRetry: vi.fn(),
    onCreateCheckout: vi.fn(),
    onCancelSubscription: vi.fn(),
  },
  ...overrides,
});

describe('SettingsPlanPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the server plan and current daily usage limits', () => {
    render(<SettingsPlanPanel {...makeProps()} />);

    expect(screen.getByRole('heading', { name: 'Your Plan' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Current plan' })).toHaveClass('bg-[var(--surface)]');
    expect(screen.getByText('Practice Sessions')).toBeVisible();
    expect(
      screen.getByText('Practice Sessions').closest('[aria-label="Current plan"]')
    ).toBeTruthy();
    expect(screen.getByText('Free plan')).toBeVisible();
    expect(screen.getByText('2 / 3')).toBeVisible();
    expect(screen.getByText('10', { exact: true })).toBeVisible();
    expect(screen.getByText('2 / 5')).toBeVisible();
    expect(screen.getByText('1 / 3')).toBeVisible();
    expect(screen.getAllByText('Higher daily practice limits')).toHaveLength(2);
    expect(screen.getAllByText('More questions per session')).toHaveLength(2);
  });

  it('shows administrative access without offering purchase or cancellation controls', () => {
    render(<SettingsPlanPanel {...makeProps({ role: 'ADMIN' })} />);

    expect(screen.getByText('Admin access')).toBeVisible();
    expect(
      screen.getByText('Administrative access includes all product capabilities.')
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: /upgrade to premium/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel subscription/i })).not.toBeInTheDocument();
  });

  it('lets a user choose a term and starts checkout without displaying a client price', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<SettingsPlanPanel {...props} />);

    await user.click(screen.getByRole('button', { name: /monthly/i }));
    await user.click(screen.getByRole('button', { name: /upgrade to premium/i }));

    expect(props.billing.onCreateCheckout).toHaveBeenCalledWith('monthly');
    expect(screen.queryByText(/\$|299|1,999|INR/)).not.toBeInTheDocument();
    expect(screen.getByText(/price is shown by razorpay/i)).toBeVisible();
  });

  it('links only to an HTTPS Razorpay hosted checkout', () => {
    const props = makeProps({
      billing: {
        ...makeProps().billing,
        createdSubscription: {
          ...activeSubscription,
          status: 'created',
          checkoutUrl: 'https://rzp.io/i/test',
        },
      },
    });
    const { rerender } = render(<SettingsPlanPanel {...props} />);

    expect(screen.getByRole('link', { name: /continue to secure checkout/i })).toHaveAttribute(
      'href',
      'https://rzp.io/i/test'
    );

    rerender(
      <SettingsPlanPanel
        {...props}
        billing={{
          ...props.billing,
          createdSubscription: {
            ...props.billing.createdSubscription!,
            checkoutUrl: 'javascript:alert(1)',
          },
        }}
      />
    );
    expect(screen.queryByRole('link', { name: /continue to secure checkout/i })).toBeNull();
  });

  it('requires an explicit confirmation before scheduling cancellation', async () => {
    const user = userEvent.setup();
    const props = makeProps({
      role: 'PREMIUM',
      billing: { ...makeProps().billing, subscription: activeSubscription },
    });
    const { rerender } = render(<SettingsPlanPanel {...props} />);

    await user.click(screen.getByRole('button', { name: /cancel subscription/i }));
    expect(props.billing.onCancelSubscription).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /confirm cancellation/i }));

    expect(props.billing.onCancelSubscription).toHaveBeenCalledOnce();
    expect(screen.getByText('Active')).toBeVisible();

    rerender(
      <SettingsPlanPanel
        {...props}
        billing={{
          ...props.billing,
          subscription: { ...activeSubscription, cancelAtPeriodEnd: true },
        }}
      />
    );
    expect(screen.getByText(/premium access remains available until/i)).toBeVisible();
  });

  it('keeps the panel usable and offers retry when usage data is unavailable', async () => {
    const user = userEvent.setup();
    const props = makeProps({
      usage: {
        theoryStats: null,
        codingStats: null,
        isLoading: false,
        errorMessage: 'Redis is unavailable',
        onRetry: vi.fn(),
      },
    });
    render(<SettingsPlanPanel {...props} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Redis is unavailable');
    await user.click(screen.getByRole('button', { name: /retry usage/i }));
    expect(props.usage.onRetry).toHaveBeenCalledOnce();
  });
});
