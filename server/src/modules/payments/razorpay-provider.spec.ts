import { ConfigService } from '@nestjs/config';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RazorpayProvider } from './razorpay-provider.js';

const razorpayMocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  create: vi.fn(),
  fetch: vi.fn(),
  cancel: vi.fn(),
  refund: vi.fn(),
  refundFetch: vi.fn(),
}));

vi.mock('razorpay', () => ({
  default: vi.fn(function RazorpayMock() {
    razorpayMocks.constructor();
    return {
      subscriptions: {
        create: razorpayMocks.create,
        fetch: razorpayMocks.fetch,
        cancel: razorpayMocks.cancel,
      },
      payments: { refund: razorpayMocks.refund },
      refunds: { fetch: razorpayMocks.refundFetch, all: vi.fn() },
    };
  }),
}));

describe('RazorpayProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    razorpayMocks.create.mockResolvedValue({ id: 'sub_123' });
    razorpayMocks.fetch.mockResolvedValue({ id: 'sub_123', status: 'active' });
    razorpayMocks.cancel.mockResolvedValue({ id: 'sub_123', status: 'cancelled' });
    razorpayMocks.refund.mockResolvedValue({ id: 'rfnd_123', status: 'processed' });
    razorpayMocks.refundFetch.mockResolvedValue({ id: 'rfnd_123', status: 'processed' });
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

  it('asks Razorpay to cancel only at the end of the billing cycle', async () => {
    const provider = createProvider({
      RAZORPAY_KEY_ID: 'key_test',
      RAZORPAY_KEY_SECRET: 'secret_test',
      RAZORPAY_PLAN_ID_MONTHLY: 'plan_monthly',
      RAZORPAY_PLAN_ID_YEARLY: 'plan_yearly',
      RAZORPAY_WEBHOOK_SECRET: 'webhook_secret',
    });

    await provider.cancelSubscription('sub_123');

    expect(razorpayMocks.cancel).toHaveBeenCalledWith('sub_123', {
      cancel_at_cycle_end: true,
    });
  });

  it('sends an idempotent full refund with no caller-selected amount', async () => {
    const provider = createProvider({
      RAZORPAY_KEY_ID: 'key_test',
      RAZORPAY_KEY_SECRET: 'secret_test',
      RAZORPAY_PLAN_ID_MONTHLY: 'plan_monthly',
      RAZORPAY_PLAN_ID_YEARLY: 'plan_yearly',
      RAZORPAY_WEBHOOK_SECRET: 'webhook_secret',
    });
    const http = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'rfnd_123',
        payment_id: 'pay_123',
        amount: 49900,
        currency: 'INR',
        status: 'pending',
        created_at: 1793793600,
      }),
    } as unknown as Response);

    await expect(
      provider.refundPayment('pay_123', 'e4a57d52-97c2-4b08-8f3d-a4c2625cc1cf')
    ).resolves.toMatchObject({
      id: 'rfnd_123',
      payment_id: 'pay_123',
      amount: 49900,
    });
    expect(http).toHaveBeenCalledWith(
      'https://api.razorpay.com/v1/payments/pay_123/refund',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Refund-Idempotency': 'e4a57d52-97c2-4b08-8f3d-a4c2625cc1cf',
        }),
        body: '{}',
      })
    );
    http.mockRestore();
  });

  it('rejects an invalid refund idempotency key before calling the provider', async () => {
    const provider = createProvider({
      RAZORPAY_KEY_ID: 'key_test',
      RAZORPAY_KEY_SECRET: 'secret_test',
    });

    await expect(provider.refundPayment('pay_123', 'short')).rejects.toThrow(BadRequestException);
  });

  it('requires a payment ID and configured credentials before requesting a refund', async () => {
    const configured = createProvider({
      RAZORPAY_KEY_ID: 'key_test',
      RAZORPAY_KEY_SECRET: 'secret_test',
    });
    await expect(
      configured.refundPayment('', 'e4a57d52-97c2-4b08-8f3d-a4c2625cc1cf')
    ).rejects.toThrow(BadRequestException);

    const unconfigured = createProvider({});
    await expect(
      unconfigured.refundPayment('pay_123', 'e4a57d52-97c2-4b08-8f3d-a4c2625cc1cf')
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('reports Razorpay API errors without returning provider error details', async () => {
    const provider = createProvider({
      RAZORPAY_KEY_ID: 'key_test',
      RAZORPAY_KEY_SECRET: 'secret_test',
    });
    const http = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'BAD_REQUEST_ERROR', description: 'sensitive detail' } }),
    } as unknown as Response);

    await expect(
      provider.refundPayment('pay_123', 'e4a57d52-97c2-4b08-8f3d-a4c2625cc1cf')
    ).rejects.toMatchObject({
      name: 'RazorpayApiError',
      statusCode: 400,
      code: 'BAD_REQUEST_ERROR',
      message: 'Razorpay refund request failed',
    });
    http.mockRestore();
  });

  it('handles non-JSON Razorpay failures without exposing response details', async () => {
    const provider = createProvider({
      RAZORPAY_KEY_ID: 'key_test',
      RAZORPAY_KEY_SECRET: 'secret_test',
    });
    const http = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not JSON');
      },
    } as unknown as Response);

    await expect(
      provider.refundPayment('pay_123', 'e4a57d52-97c2-4b08-8f3d-a4c2625cc1cf')
    ).rejects.toMatchObject({ statusCode: 502, code: undefined });
    http.mockRestore();
  });

  it('rejects malformed successful refund responses', async () => {
    const provider = createProvider({
      RAZORPAY_KEY_ID: 'key_test',
      RAZORPAY_KEY_SECRET: 'secret_test',
    });
    const http = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'rfnd_123', amount: '49900' }),
    } as Response);

    await expect(
      provider.refundPayment('pay_123', 'e4a57d52-97c2-4b08-8f3d-a4c2625cc1cf')
    ).rejects.toThrow('Razorpay returned an invalid refund response');
    http.mockRestore();
  });

  it('requires credentials before fetching a refund', async () => {
    const provider = createProvider({});

    await expect(provider.fetchRefund('rfnd_123')).rejects.toThrow(ServiceUnavailableException);
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
