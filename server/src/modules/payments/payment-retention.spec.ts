import { describe, expect, it } from 'vitest';
import { getPaymentChargeRetentionCutoff } from './payment-retention.js';

describe('payment charge retention', () => {
  it('uses a seven-year UTC calendar cutoff', () => {
    expect(getPaymentChargeRetentionCutoff(new Date('2033-01-02T03:04:05.000Z'))).toEqual(
      new Date('2026-01-02T03:04:05.000Z')
    );
  });

  it('does not mutate the supplied clock value', () => {
    const now = new Date('2033-01-02T03:04:05.000Z');
    getPaymentChargeRetentionCutoff(now);
    expect(now).toEqual(new Date('2033-01-02T03:04:05.000Z'));
  });
});
