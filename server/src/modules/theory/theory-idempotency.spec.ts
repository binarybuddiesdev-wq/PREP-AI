import { describe, expect, it } from 'vitest';
import { createTheoryAnswerId } from './theory-idempotency.js';

describe('createTheoryAnswerId', () => {
  it('creates a stable UUID for the same session and idempotency key', () => {
    const firstId = createTheoryAnswerId('session_001', 'request_001');

    expect(createTheoryAnswerId('session_001', 'request_001')).toBe(firstId);
    expect(firstId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('creates different UUIDs for different sessions or keys', () => {
    const answerId = createTheoryAnswerId('session_001', 'request_001');

    expect(createTheoryAnswerId('session_002', 'request_001')).not.toBe(answerId);
    expect(createTheoryAnswerId('session_001', 'request_002')).not.toBe(answerId);
  });
});
