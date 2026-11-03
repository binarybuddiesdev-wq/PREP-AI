import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  createIdempotencyOperationId,
  createIdempotencyRequestFingerprint,
  requireIdempotencyKey,
} from './idempotency.js';

describe('idempotency policy helpers', () => {
  it('requires a visible ASCII key between one and 128 characters', () => {
    expect(requireIdempotencyKey('client-request-1')).toBe('client-request-1');

    for (const key of [
      undefined,
      1,
      '',
      ' leading',
      'trailing ',
      'two words',
      'line\nbreak',
      'é',
      'x'.repeat(129),
    ]) {
      expect(() => requireIdempotencyKey(key)).toThrow(BadRequestException);
    }
  });

  it('produces the same request fingerprint when object key order differs', () => {
    expect(
      createIdempotencyRequestFingerprint('coding-execution', {
        sessionId: 'session-1',
        request: { language: 'javascript', code: 'return 1' },
      })
    ).toBe(
      createIdempotencyRequestFingerprint('coding-execution', {
        request: { code: 'return 1', language: 'javascript' },
        sessionId: 'session-1',
      })
    );
  });

  it('changes the fingerprint when scope or request content changes', () => {
    const baseline = createIdempotencyRequestFingerprint('coding-run', { code: 'return 1' });

    expect(createIdempotencyRequestFingerprint('coding-submit', { code: 'return 1' })).not.toBe(
      baseline
    );
    expect(createIdempotencyRequestFingerprint('coding-run', { code: 'return 2' })).not.toBe(
      baseline
    );
  });

  it('canonicalizes arrays, null values, and omitted object properties', () => {
    expect(createIdempotencyRequestFingerprint('test', { values: [null, 'x', 1] })).toBe(
      createIdempotencyRequestFingerprint('test', { ignored: undefined, values: [null, 'x', 1] })
    );
    expect(createIdempotencyRequestFingerprint('test', null)).not.toBe(
      createIdempotencyRequestFingerprint('test', [])
    );
    expect(createIdempotencyRequestFingerprint('test', undefined)).toBe(
      createIdempotencyRequestFingerprint('test', null)
    );
  });

  it('creates a stable UUID per authenticated actor, scope, and key', () => {
    const id = createIdempotencyOperationId('user-1', 'coding-execution', 'request-1');

    expect(createIdempotencyOperationId('user-1', 'coding-execution', 'request-1')).toBe(id);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(createIdempotencyOperationId('user-2', 'coding-execution', 'request-1')).not.toBe(id);
    expect(createIdempotencyOperationId('user-1', 'other-operation', 'request-1')).not.toBe(id);
    expect(createIdempotencyOperationId('user-1', 'coding-execution', 'request-2')).not.toBe(id);
  });
});
