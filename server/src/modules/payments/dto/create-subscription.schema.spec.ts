import { describe, expect, it } from 'vitest';
import {
  createSubscriptionSchema,
  isValidPaymentIdempotencyKey,
} from './create-subscription.schema.js';

describe('payment subscription request validation', () => {
  it.each(['monthly', 'yearly'])('accepts the configured %s plan key', (plan) => {
    expect(createSubscriptionSchema.parse({ plan })).toEqual({ plan });
  });

  it('rejects arbitrary plan IDs and browser-supplied prices', () => {
    expect(createSubscriptionSchema.safeParse({ plan: 'plan_from_client' }).success).toBe(false);
    expect(createSubscriptionSchema.safeParse({ plan: 'monthly', amount: 1 }).success).toBe(false);
  });

  it('requires a bounded idempotency key with safe characters', () => {
    expect(isValidPaymentIdempotencyKey('subscribe:user_1:monthly')).toBe(true);
    expect(isValidPaymentIdempotencyKey('')).toBe(false);
    expect(isValidPaymentIdempotencyKey('x'.repeat(201))).toBe(false);
    expect(isValidPaymentIdempotencyKey('key\nforged')).toBe(false);
  });
});
