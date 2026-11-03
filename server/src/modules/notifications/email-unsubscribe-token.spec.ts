import { describe, expect, it } from 'vitest';
import { createUnsubscribeToken, verifyUnsubscribeToken } from './email-unsubscribe-token.js';

describe('email unsubscribe tokens', () => {
  it('round-trips a user identity using an HMAC signature', () => {
    const token = createUnsubscribeToken('user-123', 'secret'.repeat(6));

    expect(verifyUnsubscribeToken(token, 'secret'.repeat(6))).toBe('user-123');
  });

  it('rejects tampering, malformed tokens, and a different secret', () => {
    const secret = 'secret'.repeat(6);
    const token = createUnsubscribeToken('user-123', secret);

    expect(verifyUnsubscribeToken(`${token}x`, secret)).toBeNull();
    expect(verifyUnsubscribeToken(token, 'other'.repeat(6))).toBeNull();
    expect(verifyUnsubscribeToken('not-a-token', secret)).toBeNull();
    expect(
      verifyUnsubscribeToken(createUnsubscribeToken('u'.repeat(400), secret), secret)
    ).toBeNull();
    expect(verifyUnsubscribeToken(createUnsubscribeToken('', secret), secret)).toBeNull();
  });
});
