import { BadRequestException } from '@nestjs/common';

export interface IRazorpaySubscriptionEvent {
  eventType: string;
  eventAt: Date;
  subscriptionId: string;
  planId: string;
  status: string;
  updatedAt: Date;
  userId: string;
  idempotencyKey: string;
  currentStart: Date | null;
  currentEnd: Date | null;
  charge: IRazorpayCapturedCharge | null;
}

export interface IRazorpayCapturedCharge {
  paymentId: string;
  invoiceId: string | null;
  amountMinor: number;
  currency: string;
  chargedAt: Date;
}

const SUPPORTED_EVENTS = new Set([
  'subscription.authenticated',
  'subscription.activated',
  'subscription.charged',
  'subscription.pending',
  'subscription.halted',
  'subscription.paused',
  'subscription.resumed',
  'subscription.cancelled',
  'subscription.completed',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function epochDate(value: unknown): Date | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseRazorpaySubscriptionEvent(input: unknown): IRazorpaySubscriptionEvent {
  const root = asRecord(input);
  const eventType = typeof root['event'] === 'string' ? root['event'] : '';
  const entity = asRecord(asRecord(asRecord(root['payload'])['subscription'])['entity']);
  const notes = asRecord(entity['notes']);
  const eventAt = epochDate(root['created_at']);
  const updatedAt = epochDate(entity['updated_at']) ?? eventAt;
  const id = entity['id'];
  const planId = entity['plan_id'];
  const status = entity['status'];
  const userId = notes['prepai_user_id'];
  const idempotencyKey = notes['prepai_request_id'];
  const payment = asRecord(asRecord(asRecord(root['payload'])['payment'])['entity']);
  const charge = eventType === 'subscription.charged' ? parseCapturedCharge(payment) : null;

  if (
    !SUPPORTED_EVENTS.has(eventType) ||
    !eventAt ||
    !updatedAt ||
    typeof id !== 'string' ||
    !id ||
    typeof planId !== 'string' ||
    !planId ||
    typeof status !== 'string' ||
    !status ||
    typeof userId !== 'string' ||
    !userId ||
    typeof idempotencyKey !== 'string' ||
    !idempotencyKey
  ) {
    throw new BadRequestException('Invalid or unsupported Razorpay subscription event');
  }

  return {
    eventType,
    eventAt,
    subscriptionId: id,
    planId,
    status,
    updatedAt,
    userId,
    idempotencyKey,
    currentStart: epochDate(entity['current_start']),
    currentEnd: epochDate(entity['current_end']),
    charge,
  };
}

function parseCapturedCharge(payment: Record<string, unknown>): IRazorpayCapturedCharge {
  const paymentId = payment['id'];
  const amount = payment['amount'];
  const currency = payment['currency'];
  const status = payment['status'];
  const captured = payment['captured'];
  const chargedAt = epochDate(payment['created_at']);
  if (
    typeof paymentId !== 'string' ||
    !paymentId ||
    typeof amount !== 'number' ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > 2_147_483_647 ||
    typeof currency !== 'string' ||
    !/^[A-Z]{3}$/.test(currency) ||
    status !== 'captured' ||
    !(captured === true || captured === 1 || captured === '1') ||
    !chargedAt
  ) {
    throw new BadRequestException('Invalid captured Razorpay subscription payment');
  }

  return {
    paymentId,
    invoiceId: typeof payment['invoice_id'] === 'string' ? payment['invoice_id'] : null,
    amountMinor: amount,
    currency,
    chargedAt,
  };
}
