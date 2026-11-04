import { describe, expect, it } from 'vitest';
import { decideSubscriptionRequest } from './subscription-request.js';

describe('subscription idempotency decisions', () => {
  it('reuses a matching request without creating a second provider subscription', () => {
    expect(
      decideSubscriptionRequest(
        { idempotencyKey: 'request-1', planKey: 'monthly' },
        'request-1',
        'monthly'
      )
    ).toBe('reuse');
  });

  it('rejects reuse of a key for a different plan', () => {
    expect(
      decideSubscriptionRequest(
        { idempotencyKey: 'request-1', planKey: 'monthly' },
        'request-1',
        'yearly'
      )
    ).toBe('conflict');
  });

  it('allows a new key to be checked for an existing subscription separately', () => {
    expect(decideSubscriptionRequest(null, 'request-2', 'yearly')).toBe('create');
  });
});
