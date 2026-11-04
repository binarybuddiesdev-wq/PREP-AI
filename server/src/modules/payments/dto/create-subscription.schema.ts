import { z } from 'zod';

export const createSubscriptionSchema = z
  .object({
    plan: z.enum(['monthly', 'yearly']),
  })
  .strict();

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const PAYMENT_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;

export function isValidPaymentIdempotencyKey(value: string | undefined): value is string {
  return Boolean(value && PAYMENT_IDEMPOTENCY_KEY_PATTERN.test(value));
}
