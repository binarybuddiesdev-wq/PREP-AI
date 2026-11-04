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

interface IRazorpayClient {
  subscriptions: {
    create(input: Record<string, unknown>): Promise<IRazorpaySubscription>;
    fetch(subscriptionId: string): Promise<IRazorpaySubscription>;
    cancel(
      subscriptionId: string,
      options: { cancel_at_cycle_end: true }
    ): Promise<IRazorpaySubscription>;
  };
}

@Injectable()
export class RazorpayProvider {
  private readonly client?: IRazorpayClient;
  private readonly keyConfigured: boolean;
  private readonly monthlyPlanId?: string;
  private readonly yearlyPlanId?: string;
  readonly webhookSecret?: string;

  constructor(config: ConfigService) {
    const keyId = getConfiguredValue(config.get<string>('RAZORPAY_KEY_ID'));
    const keySecret = getConfiguredValue(config.get<string>('RAZORPAY_KEY_SECRET'));
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

  private requireClient(): IRazorpayClient {
    if (!this.isCheckoutConfigured || !this.client) {
      throw new ServiceUnavailableException(
        'Razorpay subscriptions are not configured on this server'
      );
    }
    return this.client;
  }
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
