import { ConfigService } from '@nestjs/config';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RazorpayProvider } from './razorpay-provider.js';

const razorpayMocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  create: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('razorpay', () => ({
  default: vi.fn(function RazorpayMock() {
    razorpayMocks.constructor();
    return { subscriptions: { create: razorpayMocks.create, fetch: razorpayMocks.fetch } };
  }),
}));

describe('RazorpayProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    razorpayMocks.create.mockResolvedValue({ id: 'sub_123' });
    razorpayMocks.fetch.mockResolvedValue({ id: 'sub_123', status: 'active' });
  });

  const createProvider = (values: Record<string, string | undefined>) =>
    new RazorpayProvider({ get: (key: string) => values[key] } as unknown as ConfigService);

  it('stays disabled when Razorpay credentials or both plan IDs are incomplete', async () => {
    const provider = createProvider({ RAZORPAY_KEY_ID: 'key_test' });

    expect(provider.isCheckoutConfigured).toBe(false);
    expect(() => provider.getPlanId('monthly')).toThrow(BadRequestException);
    await expect(provider.createSubscription('user_1', 'monthly', 'request_1')).rejects.toThrow(
      ServiceUnavailableException
    );
    expect(razorpayMocks.constructor).not.toHaveBeenCalled();
  });

  it('treats the checked-in environment placeholders as unconfigured', () => {
    const provider = createProvider({
      RAZORPAY_KEY_ID: 'your_api_key_id_here',
      RAZORPAY_KEY_SECRET: 'your_api_secret_here',
      RAZORPAY_WEBHOOK_SECRET: 'your_webhook_secret_here',
      RAZORPAY_PLAN_ID_MONTHLY: 'plan_monthly_from_razorpay_dashboard',
      RAZORPAY_PLAN_ID_YEARLY: 'plan_yearly_from_razorpay_dashboard',
    });

    expect(provider.isCheckoutConfigured).toBe(false);
    expect(provider.isWebhookConfigured).toBe(false);
    expect(razorpayMocks.constructor).not.toHaveBeenCalled();
  });

  it('creates a monthly subscription using only the configured plan ID', async () => {
    const provider = createProvider({
      RAZORPAY_KEY_ID: 'key_test',
      RAZORPAY_KEY_SECRET: 'secret_test',
      RAZORPAY_PLAN_ID_MONTHLY: 'plan_monthly',
      RAZORPAY_PLAN_ID_YEARLY: 'plan_yearly',
      RAZORPAY_WEBHOOK_SECRET: 'webhook_secret',
    });

    await provider.createSubscription('user_1', 'monthly', 'request_1');

    expect(razorpayMocks.create).toHaveBeenCalledWith({
      plan_id: 'plan_monthly',
      total_count: 120,
      quantity: 1,
      customer_notify: 1,
      notes: { prepai_user_id: 'user_1', prepai_request_id: 'request_1' },
    });
  });

  it('bounds yearly subscriptions to ten years and fetches current provider state', async () => {
    const provider = createProvider({
      RAZORPAY_KEY_ID: 'key_test',
      RAZORPAY_KEY_SECRET: 'secret_test',
      RAZORPAY_PLAN_ID_MONTHLY: 'plan_monthly',
      RAZORPAY_PLAN_ID_YEARLY: 'plan_yearly',
      RAZORPAY_WEBHOOK_SECRET: 'webhook_secret',
    });

    await provider.createSubscription('user_1', 'yearly', 'request_2');
    await provider.fetchSubscription('sub_123');

    expect(razorpayMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ plan_id: 'plan_yearly', total_count: 10 })
    );
    expect(razorpayMocks.fetch).toHaveBeenCalledWith('sub_123');
  });

  it('requires the independent webhook secret before enabling webhook processing', () => {
    const provider = createProvider({
      RAZORPAY_KEY_ID: 'key_test',
      RAZORPAY_KEY_SECRET: 'secret_test',
      RAZORPAY_PLAN_ID_MONTHLY: 'plan_monthly',
      RAZORPAY_PLAN_ID_YEARLY: 'plan_yearly',
      RAZORPAY_WEBHOOK_SECRET: 'webhook_secret',
    });

    expect(provider.webhookSecret).toBe('webhook_secret');
  });

  it('does not enable checkout until webhook processing can be verified', () => {
    const provider = createProvider({
      RAZORPAY_KEY_ID: 'key_test',
      RAZORPAY_KEY_SECRET: 'secret_test',
      RAZORPAY_PLAN_ID_MONTHLY: 'plan_monthly',
      RAZORPAY_PLAN_ID_YEARLY: 'plan_yearly',
    });

    expect(provider.isCheckoutConfigured).toBe(false);
    expect(provider.isWebhookConfigured).toBe(false);
  });
});
