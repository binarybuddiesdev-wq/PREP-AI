import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';

export type TPaymentPlanKey = 'monthly' | 'yearly';

export interface IRazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  short_url?: string | null;
  current_start?: number | null;
  current_end?: number | null;
  updated_at?: number | null;
  has_scheduled_changes?: boolean;
  change_scheduled_at?: number | null;
  notes?: Record<string, string | number>;
}

export interface IRazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processed' | 'failed';
  created_at: number;
}

export class RazorpayApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string | undefined,
    message: string
  ) {
    super(message);
    this.name = 'RazorpayApiError';
  }
}

interface IRazorpayClient {
  subscriptions: {
    create(input: Record<string, unknown>): Promise<IRazorpaySubscription>;
    fetch(subscriptionId: string): Promise<IRazorpaySubscription>;
    cancel(
      subscriptionId: string,
      options: { cancel_at_cycle_end: true }
    ): Promise<IRazorpaySubscription>;
  };
  refunds: {
    fetch(refundId: string): Promise<IRazorpayRefund>;
    all(options: { payment_id: string; count: number }): Promise<{ items: IRazorpayRefund[] }>;
  };
}

@Injectable()
export class RazorpayProvider {
  private readonly client?: IRazorpayClient;
  private readonly keyConfigured: boolean;
  private readonly keyId?: string;
  private readonly keySecret?: string;
  private readonly monthlyPlanId?: string;
  private readonly yearlyPlanId?: string;
  readonly webhookSecret?: string;

  constructor(config: ConfigService) {
    const keyId = getConfiguredValue(config.get<string>('RAZORPAY_KEY_ID'));
    const keySecret = getConfiguredValue(config.get<string>('RAZORPAY_KEY_SECRET'));
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.monthlyPlanId = getConfiguredValue(config.get<string>('RAZORPAY_PLAN_ID_MONTHLY'));
    this.yearlyPlanId = getConfiguredValue(config.get<string>('RAZORPAY_PLAN_ID_YEARLY'));
    this.webhookSecret = getConfiguredValue(config.get<string>('RAZORPAY_WEBHOOK_SECRET'));
    this.keyConfigured = Boolean(keyId && keySecret);

    if (this.keyConfigured) {
      this.client = new Razorpay({
        key_id: keyId!,
        key_secret: keySecret!,
      }) as unknown as IRazorpayClient;
    }
  }

  get isCheckoutConfigured(): boolean {
    return Boolean(this.client && this.monthlyPlanId && this.yearlyPlanId && this.webhookSecret);
  }

  get isWebhookConfigured(): boolean {
    return this.isCheckoutConfigured && Boolean(this.webhookSecret);
  }

  getPlanId(plan: TPaymentPlanKey): string {
    if (plan === 'monthly' && this.monthlyPlanId) return this.monthlyPlanId;
    if (plan === 'yearly' && this.yearlyPlanId) return this.yearlyPlanId;
    throw new BadRequestException('The selected subscription plan is not configured');
  }

  async createSubscription(
    userId: string,
    plan: TPaymentPlanKey,
    idempotencyKey: string
  ): Promise<IRazorpaySubscription> {
    const client = this.requireClient();
    return client.subscriptions.create({
      plan_id: this.getPlanId(plan),
      total_count: plan === 'monthly' ? 120 : 10,
      quantity: 1,
      customer_notify: 1,
      notes: { prepai_user_id: userId, prepai_request_id: idempotencyKey },
    });
  }

  async fetchSubscription(subscriptionId: string): Promise<IRazorpaySubscription> {
    return this.requireClient().subscriptions.fetch(subscriptionId);
  }

  async cancelSubscription(subscriptionId: string): Promise<IRazorpaySubscription> {
    return this.requireClient().subscriptions.cancel(subscriptionId, {
      cancel_at_cycle_end: true,
    });
  }

  async refundPayment(paymentId: string, idempotencyKey: string): Promise<IRazorpayRefund> {
    if (!paymentId) throw new BadRequestException('A Razorpay payment ID is required');
    if (!/^[A-Za-z0-9_-]{10,128}$/.test(idempotencyKey)) {
      throw new BadRequestException('A valid refund idempotency key is required');
    }
    if (!this.keyConfigured || !this.keyId || !this.keySecret) {
      throw new ServiceUnavailableException('Razorpay API credentials are not configured');
    }

    // The installed SDK does not allow X-Refund-Idempotency on its refund method.
    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'X-Refund-Idempotency': idempotencyKey,
        },
        body: '{}',
        signal: AbortSignal.timeout(15_000),
      }
    );
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = isRecord(body) && isRecord(body['error']) ? body['error'] : undefined;
      throw new RazorpayApiError(
        response.status,
        typeof error?.['code'] === 'string' ? error['code'] : undefined,
        'Razorpay refund request failed'
      );
    }
    if (!isRazorpayRefund(body)) throw new Error('Razorpay returned an invalid refund response');
    return body;
  }

  async fetchRefund(refundId: string): Promise<IRazorpayRefund> {
    return this.requireApiClient().refunds.fetch(refundId);
  }

  async fetchRefundsForPayment(paymentId: string): Promise<IRazorpayRefund[]> {
    const result = await this.requireApiClient().refunds.all({ payment_id: paymentId, count: 100 });
    return result.items;
  }

  private requireClient(): IRazorpayClient {
    if (!this.isCheckoutConfigured || !this.client) {
      throw new ServiceUnavailableException(
        'Razorpay subscriptions are not configured on this server'
      );
    }
    return this.client;
  }

  private requireApiClient(): IRazorpayClient {
    if (!this.client)
      throw new ServiceUnavailableException('Razorpay API credentials are not configured');
    return this.client;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRazorpayRefund(value: unknown): value is IRazorpayRefund {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['payment_id'] === 'string' &&
    typeof value['amount'] === 'number' &&
    Number.isInteger(value['amount']) &&
    typeof value['currency'] === 'string' &&
    ['pending', 'processed', 'failed'].includes(String(value['status'])) &&
    typeof value['created_at'] === 'number' &&
    Number.isInteger(value['created_at'])
  );
}

function getConfiguredValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (
    !normalized ||
    normalized.startsWith('your_') ||
    normalized.endsWith('_here') ||
    normalized.includes('_from_razorpay_dashboard')
  ) {
    return undefined;
  }
  return normalized;
}
