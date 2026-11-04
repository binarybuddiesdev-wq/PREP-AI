import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyRazorpayWebhookSignature } from './razorpay-webhook-signature.js';

describe('Razorpay webhook signature verification', () => {
  const body = Buffer.from('{"event":"subscription.activated"}');
  const secret = 'webhook-secret';
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  it('accepts a valid signature for the exact raw body', () => {
    expect(verifyRazorpayWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('rejects a signature for a changed body', () => {
    expect(
      verifyRazorpayWebhookSignature(Buffer.from(`${body.toString()} `), signature, secret)
    ).toBe(false);
  });

  it('rejects malformed signatures without throwing', () => {
    expect(verifyRazorpayWebhookSignature(body, 'not-hex', secret)).toBe(false);
  });
});
