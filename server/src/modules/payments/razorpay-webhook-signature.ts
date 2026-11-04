import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyRazorpayWebhookSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  secret: string | undefined
): boolean {
  if (!rawBody || !signature || !secret || !/^[a-f\d]{64}$/i.test(signature)) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
