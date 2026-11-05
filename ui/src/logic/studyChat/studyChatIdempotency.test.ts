import { describe, expect, it } from 'vitest';

import { createStudyChatIdempotencyKey } from './studyChatIdempotency';

describe('createStudyChatIdempotencyKey', () => {
  it('creates a unique, visible-ASCII operation key within the API limit', () => {
    const keys = new Set(Array.from({ length: 10 }, () => createStudyChatIdempotencyKey()));

    expect(keys.size).toBe(10);
    for (const key of keys) {
      expect(key.length).toBeGreaterThan(0);
      expect(key.length).toBeLessThanOrEqual(128);
      expect(key).toMatch(/^[\x21-\x7E]+$/);
    }
  });
});
