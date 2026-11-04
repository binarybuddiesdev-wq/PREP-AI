import { describe, expect, it } from 'vitest';
import { hasPaidAccess, normalizeProviderStatus } from './payment-state.js';

describe('Razorpay subscription state projection', () => {
  it('grants access only while provider status is active and paid period is current', () => {
    const now = new Date('2026-11-04T12:00:00.000Z');
    expect(
      hasPaidAccess(
        'active',
        new Date('2026-11-03T00:00:00Z'),
        new Date('2026-11-05T00:00:00Z'),
        now
      )
    ).toBe(true);
    expect(hasPaidAccess('active', null, new Date('2026-11-05T00:00:00Z'), now)).toBe(false);
    expect(hasPaidAccess('active', null, new Date('2026-11-04T12:00:00Z'), now)).toBe(false);
    expect(hasPaidAccess('created', null, new Date('2026-11-05T00:00:00Z'), now)).toBe(false);
  });

  it('normalizes unknown provider states to a non-premium status', () => {
    expect(normalizeProviderStatus('active')).toBe('active');
    expect(normalizeProviderStatus('halted')).toBe('halted');
    expect(normalizeProviderStatus('unknown-provider-state')).toBe('unknown');
  });
});
