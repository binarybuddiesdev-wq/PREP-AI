import { describe, expect, it } from 'vitest';
import { getCodingStreakDays } from './coding-stats.js';

describe('getCodingStreakDays', () => {
  const today = new Date('2026-11-05T15:30:00.000Z');

  it('counts consecutive accepted UTC dates ending today', () => {
    expect(getCodingStreakDays(['2026-11-05', '2026-11-04', '2026-11-03'], today)).toBe(3);
  });

  it('continues a streak when the last accepted day was yesterday', () => {
    expect(getCodingStreakDays(['2026-11-04', '2026-11-03'], today)).toBe(2);
  });

  it('returns zero when the last accepted day is older than yesterday', () => {
    expect(getCodingStreakDays(['2026-11-02'], today)).toBe(0);
  });

  it('ignores duplicate dates and malformed date values', () => {
    expect(
      getCodingStreakDays(['2026-11-05', '2026-11-05', 'not-a-date', '2026-11-04'], today)
    ).toBe(2);
  });

  it('ignores impossible calendar dates instead of normalizing them', () => {
    const now = new Date('2026-03-02T15:30:00.000Z');

    expect(getCodingStreakDays(['2026-02-30'], now)).toBe(0);
  });
});
